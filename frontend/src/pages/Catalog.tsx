import { useEffect, useState, useMemo } from "react";
import {
  Database,
  Search,
  Table as TableIcon,
  ChevronRight,
} from "lucide-react";
import { api, type CatalogTable } from "../api";

export default function Catalog() {
  const [tables, setTables] = useState<CatalogTable[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState<CatalogTable | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.catalogTables()
      .then((data) => {
        setTables(data);
        if (data.length > 0) setSelectedTable(data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredTables = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search.toLowerCase();
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    );
  }, [tables, search]);

  const sensitivityBadge = (sensitivity: string) => {
    switch (sensitivity) {
      case "public":
        return <span className="badge badge-success">PUBLIC</span>;
      case "internal":
        return <span className="badge badge-info">INTERNAL</span>;
      case "pii":
        return <span className="badge badge-warning">PII / RESTRICTED</span>;
      default:
        return <span className="badge badge-neutral">{sensitivity}</span>;
    }
  };

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Enterprise Data Catalog</h1>
          <p>Verified analytical schemas, column data types, sensitivity classifications, and join lineage</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "24px", alignItems: "start" }}>
        {/* Left Column: Table List & Search */}
        <div>
          <div style={{ position: "relative", marginBottom: "14px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-tertiary)" }} />
            <input
              type="search"
              placeholder="Search tables or columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "32px", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {loading && <div style={{ padding: "16px", color: "var(--text-tertiary)", fontSize: "13px" }}>Loading catalog metadata...</div>}
            {filteredTables.map((t) => {
              const isSelected = selectedTable?.name === t.name;
              return (
                <div
                  key={t.name}
                  onClick={() => setSelectedTable(t)}
                  className="card"
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    background: isSelected ? "var(--accent-light)" : "var(--bg-panel)",
                    borderColor: isSelected ? "var(--accent-border)" : "var(--border-subtle)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "13.5px" }}>
                      <TableIcon size={14} className={isSelected ? "text-accent" : "text-secondary"} />
                      <span>{t.name}</span>
                    </div>
                    <ChevronRight size={14} style={{ opacity: isSelected ? 1 : 0.4 }} />
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginTop: "4px" }}>
                    {t.columns.length} columns · {t.row_count ? `${t.row_count.toLocaleString()} rows` : "Schema defined"}
                  </div>
                </div>
              );
            })}
            {filteredTables.length === 0 && (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-tertiary)" }}>
                No tables match "{search}".
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Selected Table Detail */}
        {selectedTable ? (
          <div className="card" style={{ padding: "24px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Database size={20} className="text-accent" />
                  <h2 style={{ fontSize: "20px" }}>analytics.{selectedTable.name}</h2>
                  <span className="badge badge-success">Accessible</span>
                </div>
                <p style={{ color: "var(--text-secondary)", marginTop: "6px", fontSize: "13.5px" }}>
                  {selectedTable.description}
                </p>
              </div>

              <div style={{ textAlign: "right", fontSize: "12px", color: "var(--text-tertiary)" }}>
                <div>Total Records: <b style={{ color: "var(--text-primary)" }}>{selectedTable.row_count?.toLocaleString() ?? "N/A"}</b></div>
                <div>Columns Permitted: <b style={{ color: "var(--text-primary)" }}>{selectedTable.columns.length}</b></div>
              </div>
            </div>

            {/* Columns Table */}
            <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Table Columns & Classifications</h3>
            <div className="table-container" style={{ marginBottom: "24px" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Column Name</th>
                    <th>Sensitivity</th>
                    <th>Semantic Description</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTable.columns.map((c) => (
                    <tr key={c.name}>
                      <td className="mono" style={{ fontWeight: 600, color: "var(--accent)" }}>
                        {c.name}
                      </td>
                      <td>{sensitivityBadge(c.sensitivity)}</td>
                      <td style={{ color: "var(--text-secondary)" }}>{c.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Relationships & Joins */}
            {selectedTable.joins && selectedTable.joins.length > 0 && (
              <div>
                <h3 style={{ fontSize: "14px", marginBottom: "10px" }}>Declared Join Keys</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedTable.joins.map((j) => (
                    <div
                      key={j.id}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "6px",
                        background: "var(--bg-surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "12.5px",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      <div>
                        <span>{j.left}</span>
                        <span style={{ color: "var(--text-tertiary)", margin: "0 8px" }}>=</span>
                        <span>{j.right}</span>
                      </div>
                      <span className="badge badge-info">{j.cardinality}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: "40px", textAlign: "center", color: "var(--text-tertiary)" }}>
            Select a table on the left to inspect metadata.
          </div>
        )}
      </div>
    </div>
  );
}
