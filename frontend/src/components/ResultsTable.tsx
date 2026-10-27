import { useState, useMemo } from "react";
import { Download, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

interface ResultsTableProps {
  columns: string[];
  rows: unknown[][];
  truncated?: boolean;
}

export function ResultsTable({ columns, rows, truncated }: ResultsTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [filterText, setFilterText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const formatCell = (val: unknown) => {
    if (val === null || val === undefined) return <span style={{ color: "var(--text-disabled)", fontStyle: "italic" }}>null</span>;
    if (typeof val === "number") {
      return Number.isInteger(val) ? val.toLocaleString() : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(val);
  };

  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows;
    const q = filterText.toLowerCase();
    return rows.filter((r) => r.some((c) => String(c ?? "").toLowerCase().includes(q)));
  }, [rows, filterText]);

  const sortedRows = useMemo(() => {
    if (sortCol === null) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const va = a[sortCol];
      const vb = b[sortCol];
      if (typeof va === "number" && typeof vb === "number") {
        return sortAsc ? va - vb : vb - va;
      }
      const sa = String(va ?? "");
      const sb = String(vb ?? "");
      return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filteredRows, sortCol, sortAsc]);

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;
  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(colIdx);
      setSortAsc(true);
    }
  };

  const exportCsv = () => {
    if (!rows.length) return;
    const escapeCsv = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const lines = [
      columns.map(escapeCsv).join(","),
      ...sortedRows.map((r) => r.map(escapeCsv).join(",")),
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card" style={{ padding: "0", overflow: "hidden", marginBottom: "20px" }}>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          background: "var(--bg-panel-elevated)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontWeight: 600, fontSize: "14px" }}>
            Dataset Rows ({sortedRows.length.toLocaleString()}
            {truncated ? " [capped at max]" : ""})
          </span>
          {filterText && (
            <span className="badge badge-info" style={{ fontSize: "11px" }}>
              Filtered
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ position: "relative", width: "200px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "10px", color: "var(--text-tertiary)" }} />
            <input
              type="search"
              placeholder="Filter results..."
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setPage(1);
              }}
              style={{ paddingLeft: "30px", fontSize: "12px", height: "34px" }}
            />
          </div>

          <button type="button" className="btn-secondary btn-sm" onClick={exportCsv} title="Export result set to CSV file">
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="table-container" style={{ border: "none", borderRadius: "0" }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c, idx) => (
                <th key={c} onClick={() => handleSort(idx)} style={{ cursor: "pointer", userSelect: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{c}</span>
                    <ArrowUpDown size={12} style={{ opacity: sortCol === idx ? 1 : 0.3 }} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className={typeof cell === "number" ? "mono" : ""}>
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: "32px", color: "var(--text-tertiary)" }}>
                  No records match the filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          padding: "10px 18px",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "12px",
          color: "var(--text-secondary)",
          background: "var(--bg-panel-elevated)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            style={{ width: "auto", padding: "3px 8px", fontSize: "12px" }}
          >
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, sortedRows.length)} of {sortedRows.length}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
