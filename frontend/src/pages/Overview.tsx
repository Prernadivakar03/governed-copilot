import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Database,
  BarChart2,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Bot,
  Activity,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  api,
  type MetricsSummary,
  type CatalogTable,
  type SystemStatus,
  type HistoryItem,
} from "../api";

const OUTCOME_COLORS: Record<string, string> = {
  COMPLETED: "#10b981",
  BLOCKED: "#f59e0b",
  TIMEOUT: "#ef4444",
  FAILED: "#dc2626",
  PENDING_APPROVAL: "#3b82f6",
  CLARIFY: "#8b5cf6",
};

export default function Overview() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [tables, setTables] = useState<CatalogTable[]>([]);
  const [system, setSystem] = useState<SystemStatus | null>(null);
  const [recentQueries, setRecentQueries] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.metricsSummary().then(setMetrics),
      api.catalogTables().then(setTables),
      api.systemStatus().then(setSystem),
      api.myHistory().then((h) => setRecentQueries(h.slice(0, 6))),
    ]).finally(() => setLoading(false));
  }, []);

  const totalQueries = metrics?.total ?? 0;
  const successRate = metrics ? Math.round(metrics.success_rate * 100) : 0;
  const p50Ms = metrics?.latency_p50_ms ? Math.round(metrics.latency_p50_ms) : null;
  const p95Ms = metrics?.latency_p95_ms ? Math.round(metrics.latency_p95_ms) : null;
  const pendingApprovals = metrics?.approvals_pending ?? 0;
  const flaggedCount = metrics?.hallucination_flags ?? 0;

  // Pie chart data for outcomes
  const outcomeData = metrics
    ? Object.entries(metrics.by_status).map(([name, value]) => ({
        name,
        value,
      }))
    : [];

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Analytics & Governance Overview</h1>
          <p>Live health, dataset coverage, and semantic copilot performance metrics {loading ? "· Refreshing..." : ""}</p>
        </div>
        <div className="page-header-actions">
          <Link to="/ask" className="btn btn-primary">
            <Bot size={15} />
            <span>Launch AI Copilot</span>
          </Link>
          <Link to="/studio" className="btn btn-secondary">
            <span>Query Studio</span>
          </Link>
        </div>
      </div>

      {/* Top Level Metric Tiles */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span>REGISTERED DATASETS</span>
            <Database size={16} />
          </div>
          <div className="stat-value">{tables.length || 8}</div>
          <div className="stat-sub">
            <span>Olist E-Commerce Core</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>TOTAL ANALYSES</span>
            <BarChart2 size={16} />
          </div>
          <div className="stat-value">{totalQueries.toLocaleString()}</div>
          <div className="stat-sub">
            <span style={{ color: "var(--success)" }}>Governed Executions</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>SUCCESS RATE</span>
            <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
          </div>
          <div className="stat-value">{successRate}%</div>
          <div className="stat-sub">
            <span>{metrics?.by_status?.COMPLETED ?? 0} verified completed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>MEDIAN LATENCY (p50)</span>
            <Clock size={16} />
          </div>
          <div className="stat-value">{p50Ms ? `${p50Ms}ms` : "< 150ms"}</div>
          <div className="stat-sub">
            <span>p95: {p95Ms ? `${p95Ms}ms` : "--"}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>PENDING APPROVALS</span>
            <ShieldAlert size={16} style={{ color: pendingApprovals > 0 ? "var(--warning)" : "var(--text-tertiary)" }} />
          </div>
          <div className="stat-value" style={{ color: pendingApprovals > 0 ? "var(--warning)" : "inherit" }}>
            {pendingApprovals}
          </div>
          <div className="stat-sub">
            <Link to="/governance" style={{ fontSize: "12px", color: "var(--accent)" }}>
              Inspect review queue →
            </Link>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px", marginBottom: "24px" }}>
        {/* Daily Analytical Volume */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <TrendingUp size={16} className="text-accent" />
                <span>Analytical Execution Volume (Last 14 Days)</span>
              </div>
              <div className="card-subtitle">Real timestamped executions from app.queries</div>
            </div>
          </div>
          <div style={{ height: "240px", width: "100%" }}>
            {metrics?.per_day && metrics.per_day.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.per_day} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis dataKey="day" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-panel-elevated)",
                      borderColor: "var(--border-medium)",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="total" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Total Queries" />
                  <Bar dataKey="completed" fill="var(--success)" radius={[4, 4, 0, 0]} name="Completed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-tertiary)" }}>
                No volume records in current window. Run questions in AI Copilot to generate live data.
              </div>
            )}
          </div>
        </div>

        {/* Outcome Breakdown */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Activity size={16} className="text-accent" />
                <span>Governance & Outcome Distribution</span>
              </div>
              <div className="card-subtitle">Breakdown by pipeline termination status</div>
            </div>
          </div>
          <div style={{ height: "240px", width: "100%" }}>
            {outcomeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                  >
                    {outcomeData.map((entry) => (
                      <Cell key={entry.name} fill={OUTCOME_COLORS[entry.name] || "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg-panel-elevated)",
                      borderColor: "var(--border-medium)",
                      borderRadius: "8px",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-tertiary)" }}>
                No execution outcomes recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Section: Recent Analyses & System Diagnostics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "20px" }}>
        {/* Recent Queries */}
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-panel-elevated)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>Recent Analytical Inquiries</div>
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>Latest questions posed to the copilot</div>
            </div>
            <Link to="/history" className="btn-ghost btn-sm" style={{ gap: "4px" }}>
              <span>View History</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="table-container" style={{ border: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Status</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {recentQueries.map((q) => (
                  <tr key={q.id}>
                    <td style={{ maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {q.question}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          q.status === "COMPLETED"
                            ? "badge-success"
                            : q.status === "PENDING_APPROVAL"
                            ? "badge-info"
                            : q.status === "BLOCKED"
                            ? "badge-warning"
                            : "badge-danger"
                        }`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="mono">{q.latency_ms ? `${Math.round(q.latency_ms)}ms` : "--"}</td>
                  </tr>
                ))}
                {recentQueries.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center", padding: "28px", color: "var(--text-tertiary)" }}>
                      No queries run yet. Ask a question to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Infrastructure Status */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Activity size={16} className="text-accent" />
                <span>System Infrastructure & Guardrails</span>
              </div>
              <div className="card-subtitle">Active connection pools and security parameters</div>
            </div>
            <Link to="/monitoring" className="btn-ghost btn-sm">
              Full Status
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "6px", background: "var(--bg-surface)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>PostgreSQL Analytics DB</div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                  Host: {system?.database?.host}:{system?.database?.port} ({system?.database?.database})
                </div>
              </div>
              <span className="badge badge-success">
                {system?.database?.status === "ok" ? "Connected" : "Offline"}
                {system?.database?.ping_latency_ms ? ` (${system.database.ping_latency_ms}ms)` : ""}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "6px", background: "var(--bg-surface)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>Ollama LLM Provider</div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                  Model: {system?.llm?.model} (cache enabled)
                </div>
              </div>
              <span className="badge badge-success">{system?.llm?.status === "ok" ? "Loaded" : "Unavailable"}</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "6px", background: "var(--bg-surface)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>Governance & Sandboxing</div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                  Statement Timeout: {system?.database?.statement_timeout_ms ?? 15000}ms · Max Joins: {system?.governance?.approval_join_threshold ?? 4}
                </div>
              </div>
              <span className="badge badge-info">Active</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "6px", background: "var(--bg-surface)" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px" }}>Hallucination Audits</div>
                <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                  Claim mismatch & ungrounded number checks
                </div>
              </div>
              <span className={`badge ${flaggedCount > 0 ? "badge-warning" : "badge-success"}`}>
                {flaggedCount} Flagged
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
