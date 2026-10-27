import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Layers,
  Lock,
} from "lucide-react";
import { api, errorMessage, type Approval } from "../api";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function HighlightedSql({ text, sensitive }: { text: string; sensitive: string[] }) {
  if (sensitive.length === 0) return <pre className="code-viewer">{text}</pre>;
  const re = new RegExp(`(${sensitive.map(escapeRe).join("|")})`, "gi");
  return (
    <pre className="code-viewer">
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            style={{
              background: "rgba(239, 68, 68, 0.25)",
              color: "var(--danger)",
              padding: "1px 4px",
              borderRadius: "3px",
              fontWeight: 600,
            }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </pre>
  );
}

function ApprovalCard({ a, onDone }: { a: Approval; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);

  async function handleDecision() {
    if (!confirm) return;
    const kind = confirm;
    setBusy(true);
    setError("");
    try {
      const r = await api.decide(a.id, kind, reason.trim());
      onDone(`${kind === "approve" ? "Approved" : "Rejected"} request #${a.id}: query is now ${r.query.status}`);
      setConfirm(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isCommentValid = reason.trim().length >= 5;

  return (
    <div className="card" style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px", gap: "12px" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>
            {a.question}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
            Requested by <b style={{ color: "var(--text-primary)" }}>{a.requested_by}</b> · {a.gate_reason}
          </div>
        </div>

        <span className="badge badge-warning" style={{ fontSize: "11px" }}>
          EXPIRES {new Date(a.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {a.sql && (
        <div style={{ marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px" }}>
            PROPOSED SQL & SENSITIVE COLUMN REFERENCES
          </div>
          <HighlightedSql text={a.sql} sensitive={a.sensitive_columns} />
        </div>
      )}

      {a.can_decide ? (
        <div style={{ display: "flex", gap: "10px" }}>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => setConfirm("approve")}>
            <CheckCircle2 size={13} />
            <span>Approve Execution</span>
          </button>
          <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => setConfirm("reject")}>
            <XCircle size={13} />
            <span>Reject Request</span>
          </button>
        </div>
      ) : (
        <div style={{ padding: "8px 12px", borderRadius: "6px", background: "var(--warning-bg)", border: "1px solid var(--warning-border)", color: "var(--warning)", fontSize: "12px" }}>
          ⚠ Self-approval prohibited: as the requester, another authenticated steward must review this query.
        </div>
      )}

      {error && <div style={{ color: "var(--danger)", fontSize: "12px", marginTop: "8px" }}>{error}</div>}

      {/* Decision Modal / Dialog */}
      {confirm && (
        <dialog open className="confirm-dialog">
          <h2>{confirm === "approve" ? "Confirm Query Approval" : "Confirm Query Rejection"}</h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            This approval decision will be cryptographically appended to the immutable audit log.
          </p>

          <div className="form-group" style={{ margin: "14px 0" }}>
            <label htmlFor={`comment-${a.id}`}>Audit Justification (Required, min 5 chars):</label>
            <textarea
              id={`comment-${a.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide justification for approving/rejecting this analytical query..."
              rows={3}
              required
            />
          </div>

          {error && <p className="error" style={{ fontSize: "12px" }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${confirm === "approve" ? "btn-primary" : "btn-danger"}`}
              disabled={busy || !isCommentValid}
              onClick={() => void handleDecision()}
            >
              {busy ? "Signing..." : `Confirm ${confirm}`}
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}

export default function Governance() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      setApprovals(await api.approvals());
    } catch {
      // Error handled
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleDone = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
    fetchApprovals();
  };

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Governance Center & Human-in-the-Loop Gate</h1>
          <p>Dual-authorization review queue, policy gate thresholds, and sensitive column enforcement</p>
        </div>

        <button type="button" className="btn btn-secondary btn-sm" onClick={fetchApprovals}>
          Refresh Queue
        </button>
      </div>

      {toastMessage && (
        <div className="card" style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success)", marginBottom: "16px", padding: "12px 16px" }}>
          ✓ {toastMessage}
        </div>
      )}

      {/* Governance Policy Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-header">
            <span>COST THRESHOLD</span>
            <Lock size={15} />
          </div>
          <div className="stat-value">100,000</div>
          <div className="stat-sub">Explain cost &gt; 100k triggers steward gate</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>MAX PERMITTED JOINS</span>
            <Layers size={15} />
          </div>
          <div className="stat-value">4 Tables</div>
          <div className="stat-sub">&gt; 4 joins requires human sign-off</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>APPROVAL TTL</span>
            <Clock size={15} />
          </div>
          <div className="stat-value">60 Mins</div>
          <div className="stat-sub">Unapproved requests auto-expire</div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span>TOOL ALLOW-LIST</span>
            <ShieldCheck size={15} style={{ color: "var(--success)" }} />
          </div>
          <div className="stat-value">6 Tools</div>
          <div className="stat-sub">Strict pipeline name allow-listing</div>
        </div>
      </div>

      {/* Approvals Review Queue */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Shield size={18} className="text-accent" />
          <h2 style={{ fontSize: "16px" }}>
            Pending Human-in-the-Loop Review Requests ({approvals.length})
          </h2>
        </div>

        {loading ? (
          <div className="card" style={{ padding: "32px", textAlign: "center" }}>
            Loading pending approvals...
          </div>
        ) : approvals.length > 0 ? (
          approvals.map((a) => <ApprovalCard key={a.id} a={a} onDone={handleDone} />)
        ) : (
          <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>
            <CheckCircle2 size={32} style={{ color: "var(--success)", margin: "0 auto 10px" }} />
            <div>No approval requests are currently awaiting steward review.</div>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>
              High-cost queries or sensitive PII access requests will appear here automatically.
            </div>
          </div>
        )}
      </div>

      {/* Role-Based Access Control Reference */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              <ShieldCheck size={16} className="text-accent" />
              <span>Role-Based Access Policy Matrix</span>
            </div>
            <div className="card-subtitle">Server-enforced database and semantic layer access boundaries</div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>System Role</th>
                <th>Database Role</th>
                <th>Sensitivity Allowed</th>
                <th>Can Run Queries</th>
                <th>Can Decide Approvals</th>
                <th>Can Verify Hash Chain</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Analyst (alice)</td>
                <td className="mono">analyst_ro</td>
                <td><span className="badge badge-success">public, internal</span></td>
                <td>Yes</td>
                <td>No</td>
                <td>No</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Steward (sam)</td>
                <td className="mono">steward_ro</td>
                <td><span className="badge badge-warning">public, internal, pii</span></td>
                <td>Yes</td>
                <td>Yes</td>
                <td>No</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Auditor (audrey)</td>
                <td className="mono">None (App Only)</td>
                <td><span className="badge badge-info">Audits & Metrics</span></td>
                <td>No</td>
                <td>No</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Admin (adam)</td>
                <td className="mono">steward_ro</td>
                <td><span className="badge badge-warning">All Levels</span></td>
                <td>Yes</td>
                <td>Yes</td>
                <td>Yes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
