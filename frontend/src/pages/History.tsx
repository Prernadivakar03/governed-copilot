import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Search, Filter, Bot } from "lucide-react";
import { api, type HistoryItem } from "../api";

export default function History() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myHistory()
      .then(setHistory)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch = item.question.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [history, search, statusFilter]);

  const statusBadge = (s: string) => {
    switch (s) {
      case "COMPLETED":
        return <span className="badge badge-success">COMPLETED</span>;
      case "PENDING_APPROVAL":
        return <span className="badge badge-info">PENDING APPROVAL</span>;
      case "BLOCKED":
        return <span className="badge badge-warning">BLOCKED</span>;
      case "TIMEOUT":
        return <span className="badge badge-danger">TIMEOUT</span>;
      default:
        return <span className="badge badge-danger">{s}</span>;
    }
  };

  return (
    <div className="workspace-page">
      <div className="page-header">
        <div className="page-header-text">
          <h1>Query History & Execution Audit</h1>
          <p>Chronological record of analytical inquiries, generated queries, latency, and status</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: "14px 18px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ position: "relative", minWidth: "280px", flex: 1 }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-tertiary)" }} />
            <input
              type="search"
              placeholder="Search past questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: "32px", fontSize: "13px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={14} style={{ color: "var(--text-tertiary)" }} />
            <span style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>Filter Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: "auto", fontSize: "12.5px" }}
            >
              <option value="ALL">All Outcomes</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="BLOCKED">Blocked</option>
              <option value="TIMEOUT">Timeout</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="card" style={{ padding: "0", overflow: "hidden" }}>
        <div className="table-container" style={{ border: "none" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Created At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 500, maxWidth: "450px" }}>
                    {item.question}
                  </td>
                  <td>{statusBadge(item.status)}</td>
                  <td className="mono">
                    {item.latency_ms ? `${Math.round(item.latency_ms)}ms` : "--"}
                  </td>
                  <td style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td>
                    <Link
                      to="/ask"
                      className="btn-ghost btn-sm"
                      style={{ gap: "4px" }}
                      title="Load in AI Copilot"
                    >
                      <Bot size={13} />
                      <span>Copilot</span>
                    </Link>
                  </td>
                </tr>
              ))}
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "36px", color: "var(--text-tertiary)" }}>
                    Loading query history records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "36px", color: "var(--text-tertiary)" }}>
                    No query history records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
