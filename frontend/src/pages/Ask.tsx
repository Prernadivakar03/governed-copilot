import { useState, type FormEvent } from "react";
import { api, errorMessage, streamEvents, type PipelineEvent, type QueryDetail } from "../api";

const LABEL: Record<string, string> = {
  retrieve: "Retrieve context", generate: "Write SQL", validate: "Validate SQL",
  gate: "Policy gate", execute: "Run read-only", summarize: "Check answer", done: "Finished",
};

function summary(e: PipelineEvent): string {
  const s = (k: string) => (e[k] === undefined ? "" : String(e[k]));
  switch (e.stage) {
    case "retrieve": return `${Array.isArray(e.tables) ? e.tables.length : 0} tables · ${s("mode")}`;
    case "generate": return s("error") || s("status");
    case "validate": return e.verdict === "pass" ? "passed" : `rejected: ${s("reason")}`;
    case "gate": return e.approval_required ? "approval required" : s("error") || "no approval needed";
    case "execute": return s("error") || `${s("rows")} rows`;
    case "summarize": return s("verdict") || s("error");
    case "done": return s("status");
    default: return "";
  }
}

const statusClass = (s: string) =>
  s === "COMPLETED" ? "ok" : s === "PENDING_APPROVAL" || s === "CLARIFY" || s === "CANNOT_ANSWER" ? "warn" : "bad";

export default function Ask() {
  const [question, setQuestion] = useState("");
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [detail, setDetail] = useState<QueryDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || question.trim().length < 3) return;
    setBusy(true);
    setError("");
    setEvents([]);
    setDetail(null);
    try {
      const { query_id } = await api.startQuery(question.trim());
      await streamEvents(query_id, (ev) => setEvents((prev) => [...prev, ev]));
      setDetail(await api.getQuery(query_id));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const validation = [...events].reverse().find((e) => e.stage === "validate");
  const result = detail?.result;

  return (
    <>
      <h1>Ask</h1>
      <form className="card" onSubmit={(e) => void submit(e)}>
        <textarea
          placeholder="Ask a question about orders, revenue, customers, sellers…"
          value={question}
          maxLength={500}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="row">
          <button disabled={busy || question.trim().length < 3}>{busy ? "Working…" : "Ask"}</button>
          {validation && (
            <span className={`badge ${validation.verdict === "pass" ? "ok" : "bad"}`}>
              SQL {validation.verdict === "pass" ? "validated" : "rejected"}
            </span>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {events.length > 0 && (
        <>
          <h2>Pipeline</h2>
          <div className="card trace">
            {events.map((e, i) => (
              <div key={i}>
                <span>{LABEL[e.stage] ?? e.stage}</span>
                <span className="muted">{e.ms === undefined ? "" : `${e.ms} ms`}</span>
                <span>{summary(e)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {detail && (
        <>
          <h2>Answer</h2>
          <div className="card stack">
            <span className={`badge ${statusClass(detail.status)}`}>{detail.status}</span>
            {result?.answer && <div>{result.answer}</div>}
            {detail.status === "PENDING_APPROVAL" && (
              <div>Sent to a steward for approval: {detail.message}</div>
            )}
            {detail.status !== "COMPLETED" && detail.status !== "PENDING_APPROVAL" && detail.message && (
              <div>{detail.message}</div>
            )}
            {result?.notes?.map((n, i) => <div key={i} className="muted">{n}</div>)}
            {result?.flags?.map((f, i) => <div key={i} className="badge warn">{f}</div>)}
            {result?.source_ids && result.source_ids.length > 0 && (
              <div>{result.source_ids.map((id) => <span key={id} className="chip">{id}</span>)}</div>
            )}
          </div>

          {detail.sql && (
            <>
              <h2>SQL</h2>
              <pre className="sql">{detail.sql}</pre>
            </>
          )}

          {result && result.rows.length > 0 && (
            <>
              <h2>Result</h2>
              <div className="tablewrap">
                <table>
                  <thead><tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {result.rows.slice(0, 200).map((row, i) => (
                      <tr key={i}>
                        {row.map((v, j) => (
                          <td key={j} className={typeof v === "number" ? "num" : ""}>{v === null ? "" : String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(result.truncated || result.rows.length > 200) && (
                <p className="muted">
                  Showing {Math.min(result.rows.length, 200)} rows. The result was
                  {result.truncated ? " cut at the 1000-row cap." : " longer than the table shows."}
                </p>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}