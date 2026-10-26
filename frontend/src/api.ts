const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Role = "analyst" | "steward" | "auditor" | "admin";
export interface User { id?: number; username: string; role: Role }
export interface PipelineEvent { stage: string; ms?: number; [key: string]: unknown }

export interface QueryDetail {
  id: string; question: string; status: string; sql: string | null;
  message: string | null; latency_ms: number | null;
  result: {
    columns: string[]; rows: unknown[][]; truncated: boolean; answer: string | null;
    source_ids?: string[]; flags?: string[]; notes?: string[]; hallucination_flag?: boolean;
  } | null;
}
export interface Approval {
  id: number; query_id: string; gate_reason: string; created_at: string; expires_at: string;
  requested_by: string; can_decide: boolean; question: string; sql: string | null;
  sensitive_columns: string[];
}
export interface DecisionOut {
  approval_id: number; decision: string; outcome: string;
  query: { id: string; status: string; message: string | null };
}
export interface AuditEvent {
  id: number; ts: string; actor: string; actor_role: string; event: string;
  query_id: string | null; hash: string; payload?: Record<string, unknown>;
}
export interface AuditVerify { ok: boolean; checked?: number; head?: string; reason?: string; broken_at?: number }

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : "Something went wrong";

let token: string | null = null;

export async function refreshSession(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!r.ok) return false;
    token = ((await r.json()) as { access_token: string }).access_token;
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers, credentials: "include" });
  } catch {
    throw new ApiError(0, "Cannot reach the backend. Is uvicorn running?");
  }
  if (res.status === 401 && retry && (await refreshSession())) return request<T>(path, init, false);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch { /* keep statusText */ }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export async function streamEvents(id: string, onEvent: (e: PipelineEvent) => void): Promise<void> {
  const res = await fetch(`${BASE}/queries/${id}/events`, {
    headers: { Authorization: `Bearer ${token ?? ""}` },
    credentials: "include",
  });
  if (!res.ok || !res.body) throw new ApiError(res.status, "Could not open the live trace");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (chunk.startsWith("data: ")) onEvent(JSON.parse(chunk.slice(6)) as PipelineEvent);
    }
  }
}

export const api = {
  async login(username: string, password: string): Promise<User> {
    const r = await request<{ access_token: string; user: User }>(
      "/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }, false);
    token = r.access_token;
    return r.user;
  },
  me: () => request<User>("/auth/me"),
  async logout(): Promise<void> {
    try { await request("/auth/logout", { method: "POST" }); } finally { token = null; }
  },
  startQuery: (question: string) =>
    request<{ query_id: string; status: string }>("/queries?stream=true",
      { method: "POST", body: JSON.stringify({ question }) }),
  getQuery: (id: string) => request<QueryDetail>(`/queries/${id}`),
  approvals: () => request<Approval[]>("/approvals"),
  decide: (id: number, kind: "approve" | "reject", reason: string) =>
    request<DecisionOut>(`/approvals/${id}/${kind}`, { method: "POST", body: JSON.stringify({ reason }) }),
  auditVerify: () => request<AuditVerify>("/audit/verify"),
  auditEvents: () => request<AuditEvent[]>("/audit/events?limit=50"),
  metricsSummary: () => request<MetricsSummary>("/metrics/summary"),
  evalRuns: () => request<EvalRun[]>("/eval/runs"),
};


export interface Rate { value: number | null; lo: number | null; hi: number | null; n: number }
export interface MetricsSummary {
  total: number; by_status: Record<string, number>; success_rate: number; block_rate: number;
  latency_p50_ms: number | null; latency_p95_ms: number | null;
  approvals_pending: number; hallucination_flags: number; denied_events: number;
  claim_mismatch_count: number;
  per_day: { day: string; total: number; completed: number }[];
}
export interface EvalRun {
  id: string;
  meta: { system?: string; started?: string; llm_cache?: boolean; frozen?: boolean };
  summary: {
    execution_accuracy?: Rate; hallucination_rate?: Rate; unauthorized_access_rate?: Rate;
    security_block_rate?: Rate; latency_p50_s?: number | null;
  };
}
