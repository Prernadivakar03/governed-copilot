import { useEffect, useState } from "react";
import { api, errorMessage, type EvalRun, type MetricsSummary, type Rate } from "../api";

const pct = (r?: Rate) => (r?.value == null ? "–" : `${(r.value * 100).toFixed(1)}%`);
const ci = (r?: Rate) =>
  r?.value == null || r.lo == null || r.hi == null ? "" : ` [${(r.lo * 100).toFixed(0)}–${(r.hi * 100).toFixed(0)}]`;
const ms = (v: number | null | undefined) => (v == null ? "Unavailable" : `${Math.round(v)} ms`);

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat">
      <div className="muted">{label}</div>
      <b>{value}</b>
    </div>
  );
}

export default function Metrics() {
  const [m, setM] = useState<MetricsSummary | null>(null);
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [a, b] = await Promise.all([api.metricsSummary(), api.evalRuns()]);
        setM(a);
        setRuns(b);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const maxDay = Math.max(1, ...(m?.per_day.map((d) => d.total) ?? [1]));

  return (
    <>
      <h1>Metrics</h1>
      {error && <p className="error">{error}</p>}
      {loading && <div className="card skeleton" role="status" aria-label="Loading metrics"><span /><span /><span /></div>}
      {!loading && !m && <p className="muted">Live metrics are unavailable until the backend responds.</p>}
      {m && (
        <>
          <div className="cards">
            <Stat label="Queries" value={String(m.total)} />
            <Stat label="Success rate" value={`${(m.success_rate * 100).toFixed(1)}%`} />
            <Stat label="Block rate" value={`${(m.block_rate * 100).toFixed(1)}%`} />
            <Stat label="Latency p50" value={ms(m.latency_p50_ms)} />
            <Stat label="Latency p95" value={ms(m.latency_p95_ms)} />
            <Stat label="Awaiting approval" value={String(m.approvals_pending)} />
            <Stat label="Hallucination flags" value={String(m.hallucination_flags)} />
            <Stat label="Claim mismatches" value={String(m.claim_mismatch_count)} />
            <Stat label="Denied attempts" value={String(m.denied_events)} />
          </div>

          <h2>Queries per day (last 14 days)</h2>
          <div className="card stack">
            {m.per_day.length === 0 && <span className="muted">No queries yet.</span>}
            {m.per_day.map((d) => (
              <div key={d.day} className="mono">
                {d.day} · {d.completed}/{d.total} completed
                <div className="bar" style={{ width: `${(d.total / maxDay) * 100}%` }} />
              </div>
            ))}
          </div>

          <h2>By status</h2>
          <div className="tablewrap">
            <table>
              <tbody>
                {Object.entries(m.by_status).map(([s, n]) => (
                  <tr key={s}><td>{s}</td><td className="num">{n}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Evaluation runs</h2>
      {!loading && runs.length === 0 ? (
        <p className="muted">No evaluation runs yet. Run python eval\run_eval.py full</p>
      ) : (
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>system</th><th>started</th><th>exec. accuracy</th><th>hallucination</th><th>unauthorized</th><th>sec. block</th><th>p50</th></tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>{r.meta.system}{r.meta.frozen ? "" : " (unfrozen)"}</td>
                  <td>{r.meta.started?.replace("T", " ")}</td>
                  <td>{pct(r.summary.execution_accuracy)}{ci(r.summary.execution_accuracy)}</td>
                  <td>{pct(r.summary.hallucination_rate)}</td>
                  <td>{pct(r.summary.unauthorized_access_rate)}</td>
                  <td>{pct(r.summary.security_block_rate)}</td>
                  <td>{r.summary.latency_p50_s == null ? "–" : `${r.summary.latency_p50_s.toFixed(1)} s`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
