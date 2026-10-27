import { useEffect, useState } from "react";
import {
  Calculator,
  GitBranch,
  BookOpen,
  AlertTriangle,
} from "lucide-react";
import { api, type SemanticModel } from "../api";

export default function Semantic() {
  const [model, setModel] = useState<SemanticModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"metrics" | "joins" | "rules" | "conflicts">("metrics");

  useEffect(() => {
    api.semanticModel()
      .then(setModel)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !model) {
    return (
      <div className="workspace-page">
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          Loading semantic layer models...
        </div>
      </div>
    );
  }

  const metricsList = Object.values(model.metrics);

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Semantic Layer & Business Metrics</h1>
          <p>
            Governed semantic layer definitions version {model.version} · Enforcing approved metric calculations and join topologies
          </p>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            className={`btn-sm ${activeTab === "metrics" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("metrics")}
          >
            <Calculator size={13} />
            <span>Metrics ({metricsList.length})</span>
          </button>
          <button
            type="button"
            className={`btn-sm ${activeTab === "joins" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("joins")}
          >
            <GitBranch size={13} />
            <span>Join Graph ({model.joins.length})</span>
          </button>
          <button
            type="button"
            className={`btn-sm ${activeTab === "rules" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("rules")}
          >
            <BookOpen size={13} />
            <span>Business Rules ({model.rules.length})</span>
          </button>
          <button
            type="button"
            className={`btn-sm ${activeTab === "conflicts" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("conflicts")}
          >
            <AlertTriangle size={13} />
            <span>Conflict Resolution ({model.conflicts.length})</span>
          </button>
        </div>
      </div>

      {/* METRICS VIEW */}
      {activeTab === "metrics" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px" }}>
          {metricsList.map((m) => (
            <div key={m.name} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Calculator size={16} className="text-accent" />
                    <span style={{ fontWeight: 600, fontSize: "15px", fontFamily: "var(--font-mono)" }}>
                      {m.name}
                    </span>
                  </div>
                  <span className="badge badge-success">v{m.version} · {m.owner}</span>
                </div>

                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                  {m.description}
                </p>

                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px" }}>
                    SQL FORMULA EXPRESSION
                  </div>
                  <pre
                    className="code-viewer"
                    style={{ margin: 0, padding: "8px 12px", fontSize: "12px", color: "var(--accent)" }}
                  >
                    {m.expression}
                  </pre>
                </div>

                {m.filters && m.filters.length > 0 && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px" }}>
                      MANDATORY FILTERS
                    </div>
                    {m.filters.map((f, idx) => (
                      <span key={idx} className="badge badge-info mono" style={{ fontSize: "11px", marginRight: "4px" }}>
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-tertiary)", marginBottom: "4px" }}>
                  APPROVED SYNONYMS
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {m.synonyms.map((s) => (
                    <span key={s} className="chip-btn" style={{ padding: "2px 8px", fontSize: "11px", cursor: "default" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* JOINS TOPOLOGY VIEW */}
      {activeTab === "joins" && (
        <div className="card" style={{ padding: "0", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-panel-elevated)" }}>
            <h3 style={{ fontSize: "15px" }}>Governed Join Relationships & Cardinality</h3>
            <p style={{ fontSize: "12.5px", color: "var(--text-secondary)", marginTop: "2px" }}>
              Enforced during semantic retrieval to prevent fan-out row duplication and invalid cross-joins
            </p>
          </div>
          <div className="table-container" style={{ border: "none" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Left Key</th>
                  <th>Join Operator</th>
                  <th>Right Key</th>
                  <th>Cardinality</th>
                  <th>Relationship ID</th>
                </tr>
              </thead>
              <tbody>
                {model.joins.map((j) => (
                  <tr key={j.id}>
                    <td className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>
                      {j.left}
                    </td>
                    <td style={{ textAlign: "center", color: "var(--text-tertiary)" }}>=</td>
                    <td className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>
                      {j.right}
                    </td>
                    <td>
                      <span className="badge badge-info">{j.cardinality}</span>
                    </td>
                    <td className="mono" style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                      {j.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BUSINESS RULES VIEW */}
      {activeTab === "rules" && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <BookOpen size={16} className="text-accent" />
                <span>Enterprise Business Rules & Calculation Directives</span>
              </div>
              <div className="card-subtitle">
                Explicit analytical constraints injected into the generation prompt
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {model.rules.map((rule, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px 16px",
                  borderRadius: "8px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <span className="badge badge-neutral" style={{ marginTop: "2px" }}>
                  RULE {idx + 1}
                </span>
                <span style={{ fontSize: "13.5px", color: "var(--text-primary)" }}>{rule}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONFLICTS RESOLUTION VIEW */}
      {activeTab === "conflicts" && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <AlertTriangle size={16} style={{ color: "var(--warning)" }} />
                <span>Metric Conflict Resolution Protocols</span>
              </div>
              <div className="card-subtitle">
                Deterministic arbitration rules when ambiguous metric terms are queried
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {model.conflicts.map((cf, idx) => (
              <div
                key={idx}
                style={{
                  padding: "16px 18px",
                  borderRadius: "8px",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>Conflicting Metrics:</span>
                  {cf.metrics.map((m) => (
                    <span key={m} className="badge badge-warning mono">
                      {m}
                    </span>
                  ))}
                  <span style={{ margin: "0 6px", color: "var(--text-tertiary)" }}>·</span>
                  <span style={{ fontSize: "13px" }}>
                    Documented Default: <b style={{ color: "var(--success)" }}>{cf.default}</b>
                  </span>
                </div>
                <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{cf.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
