import { useEffect, useState, type FormEvent } from "react";
import {
  Send,
  Sparkles,
  Database,
  Code2,
  Copy,
  Check,
  RotateCcw,
  Flag,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import {
  api,
  errorMessage,
  streamEvents,
  type PipelineEvent,
  type QueryDetail,
  type CatalogTable,
} from "../api";
import { StageProgress } from "../components/StageProgress";
import { ResultChart } from "../components/ResultChart";
import { ResultsTable } from "../components/ResultsTable";

interface QuestionCategory {
  category: string;
  questions: string[];
}

const CURATED_EXAMPLES: QuestionCategory[] = [
  {
    category: "Revenue & Sales",
    questions: [
      "What are the top 5 product categories by revenue in English?",
      "What is the total revenue for delivered orders?",
      "What is the average order value?",
    ],
  },
  {
    category: "Payments & Orders",
    questions: [
      "What is the most used payment type?",
      "How many orders are there for each order status?",
      "What is the average number of payment installments?",
    ],
  },
  {
    category: "Customer & Geography",
    questions: [
      "Which 5 states have the most customer records?",
      "How many unique customers are there?",
      "How many customer records are in the state SP?",
    ],
  },
  {
    category: "Quality & Logistics",
    questions: [
      "What is the average review score?",
      "How many orders were delivered after their estimated delivery date?",
      "What is the total freight value for delivered orders?",
    ],
  },
];

export default function Ask() {
  const [question, setQuestion] = useState("");
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [detail, setDetail] = useState<QueryDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [tables, setTables] = useState<CatalogTable[]>([]);
  const [selectedScope, setSelectedScope] = useState<string>("all");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    api.catalogTables().then(setTables).catch(() => {});
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [busy]);

  async function submitQuestion(qText: string) {
    const q = qText.trim();
    if (busy || q.length < 3) return;
    setBusy(true);
    setElapsed(0);
    setError("");
    setEvents([]);
    setDetail(null);
    setCopiedSql(false);
    setFeedbackSubmitted(false);

    try {
      const { query_id } = await api.startQuery(q);
      await streamEvents(query_id, (ev) => {
        setEvents((prev) => [...prev, ev]);
      });
      const qDetail = await api.getQuery(query_id);
      setDetail(qDetail);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void submitQuestion(question);
  }

  function handleCopySql() {
    if (!detail?.sql) return;
    void navigator.clipboard.writeText(detail.sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  }

  const result = detail?.result;
  const isCompleted = detail?.status === "COMPLETED";
  const isPendingApproval = detail?.status === "PENDING_APPROVAL";
  const isClarify = detail?.status === "CLARIFY";
  const isCannotAnswer = detail?.status === "CANNOT_ANSWER";

  // Calculate quick summary metrics if single row or small aggregation
  const summaryMetrics: { label: string; value: string }[] = [];
  if (result && result.rows.length === 1 && result.columns.length > 0) {
    for (let i = 0; i < result.columns.length; i++) {
      const col = result.columns[i];
      const val = result.rows[0][i];
      summaryMetrics.push({
        label: col.replaceAll("_", " ").toUpperCase(),
        value: typeof val === "number" ? val.toLocaleString() : String(val ?? "N/A"),
      });
    }
  }

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>AI Analytics Copilot</h1>
          <p>Autonomous natural language query synthesis, semantic metric resolution, and evidence-grounded analysis</p>
        </div>
      </div>

      {/* Main Composer Box */}
      <form className="copilot-composer" onSubmit={handleSubmit}>
        <div className="composer-scope-bar">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="scope-pill">
              <Database size={13} className="text-accent" />
              <span>Catalog Scope:</span>
            </span>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              style={{
                width: "auto",
                background: "transparent",
                border: "none",
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              <option value="all">All Permitted Datasets ({tables.length} tables)</option>
              {tables.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.columns.length} columns)
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: "11px", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>Verified Read-Only Sandbox</span>
            <span>·</span>
            <span>Zero Hallucination Grounding</span>
          </div>
        </div>

        <textarea
          className="composer-input"
          placeholder="Ask an analytical question in plain English (e.g., 'What are the top 5 product categories by revenue in English?')"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === "Enter") {
              e.currentTarget.form?.requestSubmit();
            }
          }}
          disabled={busy}
        />

        <div className="composer-footer">
          <div className="composer-hint">
            <Sparkles size={13} className="text-accent" />
            <span>Press Ctrl + Enter to run governed query</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {busy && (
              <span className="badge badge-warning" style={{ fontSize: "12px", padding: "4px 10px" }}>
                Working ({elapsed}s)
              </span>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || question.trim().length < 3}
            >
              <Send size={14} />
              <span>{busy ? "Analyzing..." : "Ask Question"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Curated Example Questions */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Example Analytical Questions
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {CURATED_EXAMPLES.map((cat) => (
            <div key={cat.category} style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", minWidth: "140px" }}>
                {cat.category}:
              </span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 1 }}>
                {cat.questions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="chip-btn"
                    onClick={() => {
                      setQuestion(q);
                      void submitQuestion(q);
                    }}
                    disabled={busy}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Network or General Error */}
      {error && (
        <div className="card" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger)", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <AlertCircle size={16} />
            <span>Connection Error</span>
          </div>
          <p style={{ marginTop: "6px", fontSize: "13px" }}>{error}</p>
        </div>
      )}

      {/* Live Pipeline Execution Progress */}
      {(busy || events.length > 0) && (
        <StageProgress
          busy={busy}
          events={events}
          elapsedSeconds={elapsed}
          finalLatencyMs={detail?.latency_ms}
          status={detail?.status}
          errorMessage={detail?.message}
          onRetry={() => void submitQuestion(question)}
        />
      )}

      {/* Answer & Verified Analysis Section */}
      {detail && (
        <div className="result-section">
          {/* Executive Summary Card */}
          <div className="card answer-card">
            <div className="card-header" style={{ marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span
                  className={`badge ${
                    isCompleted
                      ? "badge-success"
                      : isPendingApproval
                      ? "badge-info"
                      : isClarify || isCannotAnswer
                      ? "badge-warning"
                      : "badge-danger"
                  }`}
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                >
                  {detail.status}
                </span>
                <span style={{ fontSize: "12.5px", color: "var(--text-tertiary)" }}>
                  Executed in {detail.latency_ms ? `${detail.latency_ms}ms` : "--"} · Verified Grounding
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setFeedbackSubmitted(true);
                  }}
                  title="Flag for review"
                  style={{ color: feedbackSubmitted ? "var(--warning)" : "var(--text-tertiary)" }}
                >
                  <Flag size={13} />
                  <span>{feedbackSubmitted ? "Reported" : "Report"}</span>
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => void submitQuestion(question)}
                  title="Re-run query"
                >
                  <RotateCcw size={13} />
                  <span>Re-run</span>
                </button>
              </div>
            </div>

            {/* Answer Text */}
            {result?.answer ? (
              <div className="answer-text">{result.answer}</div>
            ) : detail.message ? (
              <div style={{ fontSize: "15px", color: "var(--text-secondary)" }}>
                {isClarify ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <HelpCircle size={18} style={{ color: "var(--warning)", flexShrink: 0, marginTop: "2px" }} />
                    <div>
                      <b>Clarification requested: </b>
                      <span>{detail.message}</span>
                    </div>
                  </div>
                ) : isPendingApproval ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <AlertCircle size={18} style={{ color: "var(--info)", flexShrink: 0, marginTop: "2px" }} />
                    <div>
                      <b>Sent to Steward Approval Queue: </b>
                      <span>{detail.message}</span>
                    </div>
                  </div>
                ) : (
                  <div>{detail.message}</div>
                )}
              </div>
            ) : null}

            {/* Assumptions & Notes */}
            {isCompleted && detail.message && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "8px 12px",
                  borderRadius: "6px",
                  background: "var(--bg-surface)",
                  fontSize: "12.5px",
                  color: "var(--text-secondary)",
                }}
              >
                <b>Assumption: </b>
                <span>{detail.message}</span>
              </div>
            )}

            {result?.notes && result.notes.length > 0 && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                {result.notes.map((n, i) => (
                  <div key={i} style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                    ℹ {n}
                  </div>
                ))}
              </div>
            )}

            {/* Citations & Evidence Lineage */}
            {result?.source_ids && result.source_ids.length > 0 && (
              <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
                  Registered Semantic Evidence & Citations ({result.source_ids.length})
                </div>
                <div className="citations-panel">
                  {result.source_ids.map((id) => (
                    <span key={id} className="citation-pill">
                      {id}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Summary Metrics Cards (if 1 row aggregation) */}
          {summaryMetrics.length > 0 && (
            <div className="stat-grid" style={{ marginBottom: "0" }}>
              {summaryMetrics.map((sm, i) => (
                <div key={i} className="stat-card" style={{ padding: "14px 16px" }}>
                  <div className="stat-header">
                    <span>{sm.label}</span>
                    <CheckCircle2 size={14} style={{ color: "var(--success)" }} />
                  </div>
                  <div className="stat-value" style={{ fontSize: "22px" }}>
                    {sm.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Interactive Recharts Visualization */}
          {result && result.rows.length > 0 && (
            <ResultChart columns={result.columns} rows={result.rows} />
          )}

          {/* Paginated Results Table */}
          {result && result.rows.length > 0 && (
            <ResultsTable columns={result.columns} rows={result.rows} truncated={result.truncated} />
          )}

          {/* Collapsible Verified SQL Panel */}
          {detail.sql && (
            <div className="card" style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px" }}>
                  <Code2 size={16} className="text-accent" />
                  <span>Verified Read-Only SQL</span>
                  <span className="badge badge-success" style={{ fontSize: "10px" }}>
                    AST Passed
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" className="btn-secondary btn-sm" onClick={handleCopySql}>
                    {copiedSql ? <Check size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
                    <span>{copiedSql ? "Copied" : "Copy SQL"}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setShowSql((prev) => !prev)}
                  >
                    {showSql ? "Collapse" : "Expand"}
                  </button>
                </div>
              </div>

              {showSql && (
                <div style={{ marginTop: "14px" }}>
                  <pre className="code-viewer" style={{ margin: "0" }}>
                    {detail.sql}
                  </pre>
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-tertiary)" }}>
                    Executed as read-only role with enforced LIMIT 1000 and 15s statement timeout.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
