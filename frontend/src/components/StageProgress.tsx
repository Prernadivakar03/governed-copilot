import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Terminal,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { PipelineEvent } from "../api";

export interface StageProgressProps {
  busy: boolean;
  events: PipelineEvent[];
  elapsedSeconds: number;
  finalLatencyMs?: number | null;
  status?: string;
  errorMessage?: string | null;
  onRetry?: () => void;
}

interface StageDefinition {
  id: string;
  label: string;
  matcher: (events: PipelineEvent[]) => { state: "pending" | "running" | "done" | "failed"; detail?: string; ms?: number };
}

export function StageProgress({
  busy,
  events,
  elapsedSeconds,
  finalLatencyMs,
  status,
  errorMessage,
  onRetry,
}: StageProgressProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Group events by stage
  const eventsByStage = new Map<string, PipelineEvent>();
  for (const ev of events) {
    eventsByStage.set(ev.stage, ev);
  }

  const STAGES: StageDefinition[] = [
    {
      id: "retrieve",
      label: "Retrieve Semantics",
      matcher: (evs) => {
        const ev = evs.find((e) => e.stage === "retrieve");
        if (ev) {
          if (ev.error) return { state: "failed", detail: String(ev.error), ms: ev.ms };
          const tblCount = Array.isArray(ev.tables) ? ev.tables.length : 0;
          return { state: "done", detail: `${tblCount} tables identified`, ms: ev.ms };
        }
        return { state: busy ? "running" : "pending" };
      },
    },
    {
      id: "generate",
      label: "Write Governed SQL",
      matcher: (evs) => {
        const ev = evs.find((e) => e.stage === "generate");
        const retrieveEv = evs.find((e) => e.stage === "retrieve");
        if (ev) {
          if (ev.error) return { state: "failed", detail: String(ev.error), ms: ev.ms };
          return { state: "done", detail: "SQL generated", ms: ev.ms };
        }
        if (retrieveEv && busy) return { state: "running" };
        return { state: "pending" };
      },
    },
    {
      id: "validate",
      label: "Policy & Safety Validation",
      matcher: (evs) => {
        const ev = evs.find((e) => e.stage === "validate");
        const generateEv = evs.find((e) => e.stage === "generate");
        if (ev) {
          if (ev.verdict === "reject") return { state: "failed", detail: String(ev.reason || "Rejected by policy"), ms: ev.ms };
          return { state: "done", detail: "AST verified", ms: ev.ms };
        }
        if (generateEv && busy) return { state: "running" };
        return { state: "pending" };
      },
    },
    {
      id: "gate",
      label: "Governance Gate",
      matcher: (evs) => {
        const ev = evs.find((e) => e.stage === "gate");
        const validateEv = evs.find((e) => e.stage === "validate" && e.verdict === "pass");
        if (ev) {
          if (ev.error) return { state: "failed", detail: String(ev.error), ms: ev.ms };
          if (ev.approval_required) return { state: "done", detail: "Requires Approval", ms: ev.ms };
          return { state: "done", detail: "Autonomous execution approved", ms: ev.ms };
        }
        if (validateEv && busy) return { state: "running" };
        return { state: "pending" };
      },
    },
    {
      id: "execute",
      label: "Sandbox Execution",
      matcher: (evs) => {
        const ev = evs.find((e) => e.stage === "execute");
        const gateEv = evs.find((e) => e.stage === "gate");
        if (ev) {
          if (ev.error) return { state: "failed", detail: String(ev.error), ms: ev.ms };
          return { state: "done", detail: `${ev.rows ?? 0} rows retrieved`, ms: ev.ms };
        }
        if (gateEv && !gateEv.approval_required && busy) return { state: "running" };
        return { state: "pending" };
      },
    },
    {
      id: "summarize",
      label: "Evidence Grounding Audit",
      matcher: (evs) => {
        const ev = evs.find((e) => e.stage === "summarize");
        const executeEv = evs.find((e) => e.stage === "execute");
        if (ev) {
          if (ev.verdict === "ungrounded") return { state: "failed", detail: "Ungrounded numbers filtered", ms: ev.ms };
          if (ev.verdict === "grounded") return { state: "done", detail: "Evidence verified 100%", ms: ev.ms };
          return { state: "done", detail: "Completed", ms: ev.ms };
        }
        if (executeEv && busy) return { state: "running" };
        return { state: "pending" };
      },
    },
  ];

  const isFailed = status === "FAILED" || status === "BLOCKED" || status === "TIMEOUT";

  return (
    <div className="stepper-container">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {busy ? (
            <Loader2 className="animate-spin text-accent" size={16} />
          ) : isFailed ? (
            <AlertCircle size={16} style={{ color: "var(--danger)" }} />
          ) : (
            <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
          )}
          <span style={{ fontWeight: 600, fontSize: "14px" }}>
            {busy ? "Pipeline Executing..." : isFailed ? "Analysis Halted" : "Analysis Complete"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--text-secondary)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Clock size={13} />
            {busy ? `${elapsedSeconds}s elapsed` : finalLatencyMs ? `${Math.round(finalLatencyMs)}ms` : `${elapsedSeconds}s`}
          </span>

          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setShowDiagnostics((prev) => !prev)}
            style={{ fontSize: "11px", gap: "4px" }}
          >
            <Terminal size={12} />
            <span>{showDiagnostics ? "Hide Audit Trace" : "View Audit Trace"}</span>
            {showDiagnostics ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      <div className="stepper-row">
        {STAGES.map((s, idx) => {
          const res = s.matcher(events);
          return (
            <div key={s.id} className={`stage-step ${res.state}`}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", opacity: 0.7 }}>0{idx + 1}.</span>
                <span style={{ fontWeight: 600 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                {res.ms !== undefined ? `${res.ms}ms` : res.detail || res.state}
              </div>
            </div>
          );
        })}
      </div>

      {isFailed && errorMessage && (
        <div
          style={{
            marginTop: "14px",
            padding: "10px 14px",
            borderRadius: "6px",
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "13px",
          }}
        >
          <div>
            <b>Error: </b>
            <span>{errorMessage}</span>
          </div>
          {onRetry && (
            <button type="button" className="btn-secondary btn-sm" onClick={onRetry}>
              Retry Query
            </button>
          )}
        </div>
      )}

      {showDiagnostics && events.length > 0 && (
        <div style={{ marginTop: "16px", paddingTop: "14px", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "8px" }}>
            IMMUTABLE PIPELINE AUDIT EVENT STREAM
          </div>
          <div className="code-viewer" style={{ maxHeight: "200px" }}>
            {events.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: "14px", padding: "3px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ minWidth: "90px", color: "var(--accent)" }}>{e.stage}</span>
                <span style={{ minWidth: "50px", color: "var(--text-tertiary)" }}>{e.ms ?? "--"}ms</span>
                <span style={{ flex: 1, color: e.error ? "var(--danger)" : "var(--text-secondary)" }}>
                  {JSON.stringify(e)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
