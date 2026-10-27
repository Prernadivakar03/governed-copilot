import { useEffect, useState } from "react";
import {
  Database,
  Cpu,
  Layers,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { api, type SystemStatus } from "../api";

export default function Monitoring() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchStatus = () => {
    setLoading(true);
    api.systemStatus()
      .then((s) => {
        setStatus(s);
        setLastRefreshed(new Date());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const isOperational = status?.status === "operational";

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>System Health & Infrastructure Diagnostics</h1>
          <p>Real-time heartbeat, model latency telemetry, PostgreSQL connection state, and cache metrics</p>
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchStatus} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Global Status Banner */}
      <div
        className="card"
        style={{
          marginBottom: "24px",
          borderLeft: `4px solid ${isOperational ? "var(--success)" : "var(--warning)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {isOperational ? (
            <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
          ) : (
            <AlertTriangle size={24} style={{ color: "var(--warning)" }} />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: "16px" }}>
              {isOperational ? "All Governed Services Operational" : "Service Running in Degraded Mode"}
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
              Last telemetry check at {lastRefreshed.toLocaleTimeString()} · Verified read-only execution pools
            </div>
          </div>
        </div>

        <span className={`badge ${isOperational ? "badge-success" : "badge-warning"}`} style={{ fontSize: "12px" }}>
          {status?.status?.toUpperCase()}
        </span>
      </div>

      {/* Infrastructure Nodes Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px", marginBottom: "24px" }}>
        {/* PostgreSQL Node */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Database size={16} className="text-accent" />
              <span>PostgreSQL Database Engine</span>
            </div>
            <span className={`badge ${status?.database?.status === "ok" ? "badge-success" : "badge-danger"}`}>
              {status?.database?.status === "ok" ? "Connected" : "Unreachable"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Host & Port:</span>
              <span className="mono">{status?.database?.host}:{status?.database?.port}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Active Database:</span>
              <span className="mono">{status?.database?.database}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Connection Ping Latency:</span>
              <span className="mono" style={{ color: "var(--success)", fontWeight: 600 }}>
                {status?.database?.ping_latency_ms} ms
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Statement Timeout (Safety Cap):</span>
              <span className="mono">{status?.database?.statement_timeout_ms} ms (15s)</span>
            </div>
          </div>
        </div>

        {/* Ollama LLM Node */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Cpu size={16} className="text-accent" />
              <span>Local LLM Provider (Ollama)</span>
            </div>
            <span className={`badge ${status?.llm?.status === "ok" ? "badge-success" : "badge-danger"}`}>
              {status?.llm?.status === "ok" ? "Model Ready" : "Unreachable"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Active Model:</span>
              <span className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>{status?.llm?.model}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Endpoint URL:</span>
              <span className="mono">{status?.llm?.url}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Health Ping Latency:</span>
              <span className="mono" style={{ color: "var(--success)", fontWeight: 600 }}>
                {status?.llm?.ping_latency_ms} ms
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>LLM Response Cache:</span>
              <span className="mono">
                {status?.llm?.cache_enabled ? `Enabled (${status?.llm?.cached_responses} entries)` : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Semantic Retrieval & Vectors */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Layers size={16} className="text-accent" />
              <span>Semantic Retrieval & Embeddings</span>
            </div>
            <span className="badge badge-info">
              {status?.retrieval?.mode?.toUpperCase()}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Embedding Model:</span>
              <span className="mono">BAAI/bge-small-en-v1.5</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Cached Precomputed Vectors:</span>
              <span className="mono">{status?.retrieval?.cached_vectors} files (.npy)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Registered Semantic Tables:</span>
              <span className="mono">{status?.semantic_catalog?.registered_tables} tables</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Approved Business Metrics:</span>
              <span className="mono">{status?.semantic_catalog?.registered_metrics} metrics</span>
            </div>
          </div>
        </div>

        {/* Governance Guardrails */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Shield size={16} className="text-accent" />
              <span>Governance Safety Parameters</span>
            </div>
            <span className="badge badge-success">Enforced</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Query Execution Cost Limit:</span>
              <span className="mono">{status?.governance?.approval_cost_threshold}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Max Unapproved Joins:</span>
              <span className="mono">{status?.governance?.approval_join_threshold} tables</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Pending Approval Expiration:</span>
              <span className="mono">{status?.governance?.approval_ttl_minutes} minutes</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "var(--bg-surface)", borderRadius: "6px" }}>
              <span style={{ color: "var(--text-secondary)" }}>Transaction Isolation:</span>
              <span className="mono">READ ONLY (Auto Rollback)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
