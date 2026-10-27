import { Fragment, useEffect, useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Key,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { api, errorMessage, type AuditEvent, type AuditVerify } from "../api";

export default function Audit() {
  const [verify, setVerify] = useState<AuditVerify | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [v, e] = await Promise.all([api.auditVerify(), api.auditEvents()]);
      setVerify(v);
      setEvents(e);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerifyNow = async () => {
    setVerifying(true);
    try {
      const v = await api.auditVerify();
      setVerify(v);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  const filtered = useMemo(() => {
    return events.filter(
      (e) =>
        (role === "all" || e.actor_role === role) &&
        `${e.actor} ${e.event} ${e.query_id ?? ""}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [events, role, search]);

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Immutable Audit Trail & Cryptographic Verification</h1>
          <p>Tamper-evident SHA-256 hash-chained event ledger for all analytical executions and governance decisions</p>
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh Audit</span>
        </button>
      </div>

      {error && (
        <div className="card" style={{ background: "var(--danger-bg)", borderColor: "var(--danger-border)", color: "var(--danger)", marginBottom: "16px" }}>
          <b>Audit Error: </b>
          <span>{error}</span>
        </div>
      )}

      {/* Cryptographic Chain Integrity Card */}
      {verify && (
        <div
          className="card"
          style={{
            marginBottom: "20px",
            borderLeft: `4px solid ${verify.ok ? "var(--success)" : "var(--danger)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {verify.ok ? (
              <CheckCircle2 size={24} style={{ color: "var(--success)" }} />
            ) : (
              <AlertTriangle size={24} style={{ color: "var(--danger)" }} />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: "15px" }}>
                {verify.ok ? "Cryptographic Ledger Verified & Intact" : "Ledger Integrity Violation Detected!"}
              </div>
              <div style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
                {verify.ok
                  ? `All ${verify.checked} sequential records verified against SHA-256 genesis anchor with zero mutations.`
                  : `Hash mismatch at record #${verify.broken_at}: ${verify.reason}`}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {verify.head && (
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)", textAlign: "right" }}>
                <span>Head Hash: </span>
                <span className="mono" style={{ color: "var(--accent)" }}>{verify.head.slice(0, 18)}...</span>
              </div>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleVerifyNow}
              disabled={verifying}
            >
              <Key size={13} />
              <span>{verifying ? "Verifying..." : "Verify Hash Chain"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ position: "relative", minWidth: "280px", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-tertiary)" }} />
            <input
              type="search"
              placeholder="Filter by actor, event type, or query ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "32px", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={14} style={{ color: "var(--text-tertiary)" }} />
            <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Actor Role:</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ width: "auto", fontSize: "12.5px" }}
            >
              <option value="all">All Roles</option>
              <option value="analyst">Analyst</option>
              <option value="steward">Steward</option>
              <option value="auditor">Auditor</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        <div className="table-container" style={{ border: "none" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "60px" }}>#</th>
                <th>Timestamp (UTC)</th>
                <th>Actor</th>
                <th>Event Type</th>
                <th>Query Ref</th>
                <th>Hash Digest</th>
                <th style={{ width: "80px" }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const isExpanded = expanded === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr>
                      <td className="mono" style={{ fontWeight: 600 }}>{e.id}</td>
                      <td className="mono" style={{ fontSize: "12px" }}>
                        {e.ts.slice(0, 19).replace("T", " ")}
                      </td>
                      <td>
                        <span style={{ fontWeight: 500 }}>{e.actor}</span>
                        <span className="badge badge-neutral" style={{ marginLeft: "6px", fontSize: "10px" }}>
                          {e.actor_role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            e.event === "QUERY_OUTCOME"
                              ? "badge-success"
                              : e.event.includes("DENIED") || e.event.includes("REJECT")
                              ? "badge-danger"
                              : e.event.includes("APPROVAL")
                              ? "badge-warning"
                              : "badge-info"
                          }`}
                        >
                          {e.event}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {e.query_id ? e.query_id.slice(0, 8) : "--"}
                      </td>
                      <td className="mono" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                        {e.hash ? `${e.hash.slice(0, 12)}...` : "--"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost btn-sm"
                          onClick={() => setExpanded(isExpanded ? null : e.id)}
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          <span>{isExpanded ? "Close" : "Inspect"}</span>
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ background: "var(--bg-app)", padding: "16px 20px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "6px" }}>
                            IMMUTABLE PAYLOAD & HASH INTEGRITY
                          </div>
                          <pre className="code-viewer" style={{ margin: 0 }}>
                            {JSON.stringify({ payload: e.payload ?? {}, hash: e.hash }, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "var(--text-tertiary)" }}>
                    No audit records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
