import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage, streamEvents, type PipelineEvent, type QueryDetail } from "../api";

const steps = ["retrieve", "generate", "validate", "gate", "execute", "summarize"] as const;
const labels: Record<string, string> = { retrieve: "Retrieve", generate: "Write SQL", validate: "Validate", gate: "Gate", execute: "Execute", summarize: "Check" };
const examples = [
  "Summarize quarterly revenue by region.",
  "Which service tier has the most active subscriptions?",
  "Compare average delivery time across carrier groups.",
  "Show monthly support requests by team.",
];
const statusClass = (s: string) => s === "COMPLETED" ? "ok" : s === "PENDING_APPROVAL" || s === "CLARIFY" || s === "CANNOT_ANSWER" ? "warn" : "bad";
const cell = (v: unknown) => v === null || v === undefined ? "" : String(v);

export default function Ask() {
  const [question, setQuestion] = useState("");
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [detail, setDetail] = useState<QueryDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [sort, setSort] = useState<{ col: number; asc: boolean } | null>(null);
  const result = detail?.result;
  const textIndex = result?.columns.findIndex((_, i) => result.rows.some((row) => typeof row[i] === "string")) ?? -1;
  const numberIndex = result?.columns.findIndex((_, i) => result.rows.some((row) => typeof row[i] === "number")) ?? -1;
  const chartRows = result && textIndex >= 0 && numberIndex >= 0 && textIndex !== numberIndex
    ? result.rows.filter((row) => typeof row[textIndex] === "string" && typeof row[numberIndex] === "number").slice(0, 10)
    : [];
  const maxValue = Math.max(1, ...chartRows.map((row) => Number(row[numberIndex])));

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || question.trim().length < 3) return;
    setBusy(true); setElapsed(0); setError(""); setEvents([]); setDetail(null); setSort(null);
    try {
      const { query_id } = await api.startQuery(question.trim());
      await streamEvents(query_id, (ev) => setEvents((prev) => [...prev, ev]));
      setDetail(await api.getQuery(query_id));
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }

  function downloadCsv() {
    if (!result) return;
    const quote = (v: unknown) => `"${cell(v).replaceAll('"', '""')}"`;
    const csv = [result.columns, ...result.rows].map((row) => row.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "query-results.csv"; a.click(); URL.revokeObjectURL(url);
  }

  const orderedRows = result ? [...result.rows].sort((a, b) => {
    if (!sort) return 0;
    const x = a[sort.col], y = b[sort.col];
    const cmp = typeof x === "number" && typeof y === "number" ? x - y : cell(x).localeCompare(cell(y), undefined, { numeric: true });
    return sort.asc ? cmp : -cmp;
  }) : [];
  const eventsByStage = new Map<string, PipelineEvent>();
  for (const event of events) eventsByStage.set(event.stage, event);
  const failed = (ev?: PipelineEvent) => !!ev && (!!ev.error || (ev.stage === "validate" && ev.verdict === "reject"));
  const current = steps.findIndex((s) => !eventsByStage.has(s));
  const executionTime = busy ? elapsed : Math.round((detail?.latency_ms ?? 0) / 1000);

  return <>
    <h1>Ask your data</h1>
    <form className="card stack" onSubmit={(e) => void submit(e)}>
      <label htmlFor="question">Ask an analytics question</label>
      <textarea id="question" className="question-box" placeholder="Ask about orders, revenue, products, customers…" value={question} maxLength={500} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.ctrlKey && e.key === "Enter") e.currentTarget.form?.requestSubmit(); }} />
      <div className="muted">Can take up to a minute on a local model. Press Ctrl+Enter to submit.</div>
      <div className="examples" aria-label="Example questions">{examples.map((q) => <button key={q} className="ghost chip-button" type="button" onClick={() => setQuestion(q)}>{q}</button>)}</div>
      <div className="row"><button disabled={busy || question.trim().length < 3}>{busy ? "Working…" : "Ask"}</button>{busy && <span className="badge warn">{executionTime}s elapsed</span>}</div>
    </form>
    {error && <p className="error" role="alert">{error}</p>}
    {busy && events.length === 0 && <div className="card skeleton" role="status" aria-label="Loading query progress"><span /><span /><span /></div>}
    {(events.length > 0 || busy) && <>
      <h2>Query progress</h2>
      <ol className="stepper">{steps.map((step, i) => {
        const ev = eventsByStage.get(step);
        const state = failed(ev) ? "failed" : ev ? "done" : busy && (current === i || current < 0 && i === steps.length - 1) ? "running" : "pending";
        return <li key={step} className={`step ${state}`}><span className="step-dot">{state === "done" ? "✓" : i + 1}</span><span>{labels[step]}</span><small>{ev?.ms === undefined ? state : `${ev.ms} ms`}</small></li>;
      })}</ol>
      <div className="card trace">{events.map((e, i) => <div key={i}><span>{labels[e.stage] ?? e.stage}</span><span>{e.ms === undefined ? "" : `${e.ms} ms`}</span><span>{String(e.error ?? e.reason ?? e.verdict ?? e.status ?? "")}</span></div>)}</div>
    </>}
    {detail && <>
      <h2>Answer</h2><section className="card stack answer-card"><span className={`badge ${statusClass(detail.status)}`}>{detail.status}</span>
        {result?.answer && <div>{result.answer}</div>}
        {detail.status === "COMPLETED" && detail.message && <div className="assumption"><b>Assumption</b><span>{detail.message}</span></div>}
        {detail.status === "PENDING_APPROVAL" && <div>Sent to a steward for approval: {detail.message}</div>}
        {detail.status !== "COMPLETED" && detail.status !== "PENDING_APPROVAL" && detail.message && <div>{detail.message}</div>}
        {result?.notes?.map((n, i) => <div key={i} className="muted">{n}</div>)}
        {result?.flags?.map((f, i) => <div key={i} className="badge warn">{f}</div>)}
        {!!result?.source_ids?.length && <div className="examples">{result.source_ids.map((id) => <span key={id} className="chip">{id}</span>)}</div>}
      </section>
      {detail.sql && <><h2>SQL</h2><section className="card"><details><summary>View generated SQL</summary><div className="row sql-actions"><button className="ghost" onClick={() => void navigator.clipboard.writeText(detail.sql ?? "")}>Copy SQL</button></div><pre className="sql">{detail.sql}</pre></details></section></>}
      {result && result.rows.length > 0 && <><div className="row section-row"><h2>Results ({result.rows.length})</h2><button className="ghost" onClick={downloadCsv}>Download CSV</button></div><div className="tablewrap"><table><thead><tr>{result.columns.map((c, i) => <th key={c}><button className="sort-button" onClick={() => setSort((s) => ({ col: i, asc: s?.col === i ? !s.asc : true }))}>{c}{sort?.col === i ? sort.asc ? " ↑" : " ↓" : " ↕"}</button></th>)}</tr></thead><tbody>{orderedRows.slice(0, 200).map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} className={typeof v === "number" ? "num" : ""}>{cell(v)}</td>)}</tr>)}</tbody></table></div>{(result.truncated || result.rows.length > 200) && <p className="muted">Showing {Math.min(result.rows.length, 200)} rows.</p>}</>}
      {result && result.rows.length === 0 && <p className="muted">No result rows were returned.</p>}
      {chartRows.length > 0 && <><h2>{result?.columns[numberIndex]} by {result?.columns[textIndex]}</h2><section className="card chart-card"><svg viewBox={`0 0 680 ${Math.max(100, chartRows.length * 32 + 12)}`} role="img" aria-label={`${result?.columns[numberIndex]} by ${result?.columns[textIndex]}`}>
        {chartRows.map((row, i) => { const y = 8 + i * 32; const width = Number(row[numberIndex]) / maxValue * 440; return <g key={`${row[textIndex]}-${i}`}><text x="0" y={y + 17} className="chart-label">{cell(row[textIndex]).slice(0, 24)}</text><rect x="205" y={y} width={Math.max(2, width)} height="22" rx="4" className="chart-bar"/><text x={215 + width} y={y + 17} className="chart-value">{cell(row[numberIndex])}</text></g>; })}
      </svg></section></>}
    </>}
  </>;
}
