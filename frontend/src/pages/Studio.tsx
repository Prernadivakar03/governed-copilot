import { useState } from "react";
import {
  Code2,
  Play,
  ShieldCheck,
  AlertCircle,
  Database,
  CheckCircle2,
} from "lucide-react";
import {
  api,
  type StudioValidateOut,
  type StudioExecuteOut,
} from "../api";
import { ResultsTable } from "../components/ResultsTable";

const DEFAULT_SQL = `SELECT 
  o.order_status,
  COUNT(*) AS total_orders,
  ROUND(AVG(op.payment_value)::numeric, 2) AS avg_payment_val
FROM analytics.orders o
JOIN analytics.order_payments op ON o.order_id = op.order_id
GROUP BY o.order_status
ORDER BY total_orders DESC;`;

export default function Studio() {
  const [sql, setSql] = useState(DEFAULT_SQL);
  const [validation, setValidation] = useState<StudioValidateOut | null>(null);
  const [execution, setExecution] = useState<StudioExecuteOut | null>(null);
  const [validating, setValidating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValidate = async () => {
    if (!sql.trim()) return;
    setValidating(true);
    setError(null);
    try {
      const res = await api.studioValidate(sql);
      setValidation(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  };

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setExecuting(true);
    setError(null);
    try {
      const res = await api.studioExecute(sql);
      setExecution(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Governed Query Studio</h1>
          <p>Direct SQL inspection, server-side AST safety validation, cost estimation, and sandboxed execution</p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleValidate}
            disabled={validating || executing || !sql.trim()}
          >
            <ShieldCheck size={14} />
            <span>{validating ? "Validating AST..." : "Validate Policy"}</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExecute}
            disabled={validating || executing || !sql.trim()}
          >
            <Play size={14} />
            <span>{executing ? "Executing..." : "Run Read-Only Query"}</span>
          </button>
        </div>
      </div>

      {/* SQL Editor Surface */}
      <div className="card" style={{ padding: "16px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-secondary)" }}>
            <Code2 size={14} className="text-accent" />
            <span>PostgreSQL Dialect · Read-Only Analytic Role · LIMIT 1000 Enforced</span>
          </div>
          <span className="badge badge-neutral" style={{ fontSize: "10px" }}>
            Server-Side AST Sandboxing
          </span>
        </div>

        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={9}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            lineHeight: 1.5,
            background: "var(--bg-app)",
            border: "1px solid var(--border-medium)",
            borderRadius: "6px",
            padding: "12px 14px",
            color: "var(--text-primary)",
          }}
          placeholder="Enter SELECT statement..."
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="card" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger)", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <AlertCircle size={16} />
            <span>Error Encountered</span>
          </div>
          <p style={{ marginTop: "6px", fontSize: "13px" }}>{error}</p>
        </div>
      )}

      {/* Validation Results Drawer */}
      {validation && (
        <div className="card" style={{ marginBottom: "20px", borderLeft: `4px solid ${validation.valid ? "var(--success)" : "var(--danger)"}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {validation.valid ? (
                <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
              ) : (
                <AlertCircle size={16} style={{ color: "var(--danger)" }} />
              )}
              <span style={{ fontWeight: 600, fontSize: "14px" }}>
                {validation.valid ? "SQL Validated & Policy Compliant" : "Query Rejected by Governance Policy"}
              </span>
              <span className={`badge ${validation.valid ? "badge-success" : "badge-danger"}`}>
                {validation.latency_ms}ms
              </span>
            </div>

            {validation.requires_approval && (
              <span className="badge badge-warning">Steward Approval Required</span>
            )}
          </div>

          {!validation.valid && validation.error && (
            <div style={{ color: "var(--danger)", fontSize: "13px", marginTop: "4px" }}>
              <b>Rejection Reason: </b>
              <span>{validation.error}</span>
            </div>
          )}

          {validation.valid && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "12.5px", marginTop: "10px" }}>
              <div style={{ padding: "8px 12px", borderRadius: "6px", background: "var(--bg-surface)" }}>
                <span style={{ color: "var(--text-tertiary)" }}>Estimated Cost: </span>
                <b className="mono">{validation.estimated_cost?.toFixed(1) ?? "Low"}</b>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: "6px", background: "var(--bg-surface)" }}>
                <span style={{ color: "var(--text-tertiary)" }}>Sensitive Columns: </span>
                <b>{validation.sensitive_columns.length > 0 ? validation.sensitive_columns.join(", ") : "None"}</b>
              </div>
              <div style={{ padding: "8px 12px", borderRadius: "6px", background: "var(--bg-surface)" }}>
                <span style={{ color: "var(--text-tertiary)" }}>Approval Gate: </span>
                <b>{validation.gate_reason ?? "Autonomous"}</b>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Execution Results Data Table */}
      {execution && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <Database size={16} className="text-accent" />
            <span style={{ fontWeight: 600, fontSize: "14px" }}>Execution Output</span>
            <span className="badge badge-success">{execution.row_count} rows</span>
            <span className="badge badge-neutral">{execution.latency_ms}ms</span>
          </div>

          <ResultsTable columns={execution.columns} rows={execution.rows} truncated={execution.truncated} />
        </div>
      )}
    </div>
  );
}
