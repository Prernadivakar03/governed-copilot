import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { BarChart3, LineChart as LineIcon, PieChart as PieIcon } from "lucide-react";

interface ResultChartProps {
  columns: string[];
  rows: unknown[][];
}

const PALETTE = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#f97316", // Orange
  "#14b8a6", // Teal
];

export function ResultChart({ columns, rows }: ResultChartProps) {
  const [chartType, setChartType] = useState<"bar" | "line" | "pie">("bar");

  if (!columns.length || !rows.length) return null;

  // Detect dimension (string or date) and metrics (numeric)
  const stringIndex = columns.findIndex((_, idx) =>
    rows.some((row) => typeof row[idx] === "string")
  );
  const numberIndices = columns
    .map((col, idx) => ({ col, idx }))
    .filter(({ idx }) => rows.some((row) => typeof row[idx] === "number" || (!isNaN(Number(row[idx])) && row[idx] !== null && row[idx] !== "")));

  if (stringIndex < 0 || numberIndices.length === 0) {
    return null; // Not suitable for charting
  }

  const dimCol = columns[stringIndex];
  const primaryMetric = numberIndices[0];

  // Format data for Recharts (top 15 rows for clarity)
  const chartData = rows.slice(0, 15).map((row) => {
    const item: Record<string, unknown> = {
      name: String(row[stringIndex] ?? "Unknown"),
    };
    for (const { col, idx } of numberIndices) {
      const val = Number(row[idx]);
      item[col] = isNaN(val) ? 0 : val;
    }
    return item;
  });

  return (
    <div className="card" style={{ marginBottom: "20px" }}>
      <div className="card-header" style={{ marginBottom: "12px" }}>
        <div>
          <div className="card-title">
            <BarChart3 size={16} className="text-accent" />
            <span>
              {primaryMetric.col.replaceAll("_", " ")} by {dimCol.replaceAll("_", " ")}
            </span>
          </div>
          <div className="card-subtitle">
            Showing top {chartData.length} records · Derived from verified SQL execution
          </div>
        </div>

        <div style={{ display: "flex", gap: "4px" }}>
          <button
            type="button"
            className={`btn-ghost btn-sm ${chartType === "bar" ? "btn-secondary" : ""}`}
            onClick={() => setChartType("bar")}
            title="Bar Chart"
          >
            <BarChart3 size={14} />
          </button>
          <button
            type="button"
            className={`btn-ghost btn-sm ${chartType === "line" ? "btn-secondary" : ""}`}
            onClick={() => setChartType("line")}
            title="Line Chart"
          >
            <LineIcon size={14} />
          </button>
          {chartData.length <= 8 && (
            <button
              type="button"
              className={`btn-ghost btn-sm ${chartType === "pie" ? "btn-secondary" : ""}`}
              onClick={() => setChartType("pie")}
              title="Distribution Chart"
            >
              <PieIcon size={14} />
            </button>
          )}
        </div>
      </div>

      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="var(--text-tertiary)"
                fontSize={11}
                tickLine={false}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={50}
              />
              <YAxis
                stroke="var(--text-tertiary)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-panel-elevated)",
                  borderColor: "var(--border-medium)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              {numberIndices.map(({ col }, i) => (
                <Bar key={col} dataKey={col} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} maxBarSize={48} />
              ))}
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={11} angle={-25} textAnchor="end" height={50} />
              <YAxis stroke="var(--text-tertiary)" fontSize={11} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-panel-elevated)",
                  borderColor: "var(--border-medium)",
                  borderRadius: "8px",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
              {numberIndices.map(({ col }, i) => (
                <Line
                  key={col}
                  type="monotone"
                  dataKey={col}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={chartData}
                dataKey={primaryMetric.col}
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                paddingAngle={3}
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {chartData.map((_, idx) => (
                  <Cell key={`cell-${idx}`} fill={PALETTE[idx % PALETTE.length]} />
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
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
