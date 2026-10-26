import { Fragment, useEffect, useState } from "react";
import { api, errorMessage, type AuditEvent, type AuditVerify } from "../api";

export default function Audit() {
  const [verify, setVerify] = useState<AuditVerify | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [v, e] = await Promise.all([api.auditVerify(), api.auditEvents()]);
        setVerify(v);
        setEvents(e);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const filtered = events.filter((e) => (role === "all" || e.actor_role === role)
    && `${e.actor} ${e.event} ${e.query_id ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <h1>Audit log</h1>
      {error && <p className="error">{error}</p>}
      {loading && <div className="card skeleton" role="status" aria-label="Loading audit events"><span /><span /><span /></div>}
      {verify && (
        <p>
          <span className={`badge ${verify.ok ? "ok" : "bad"}`}>
            {verify.ok ? `chain intact · ${verify.checked} records` : `chain broken at #${verify.broken_at}: ${verify.reason}`}
          </span>
          {verify.head && <span className="muted mono"> head {verify.head.slice(0, 16)}…</span>}
        </p>
      )}
      <div className="row audit-filters"><label>Filter events<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Actor, event or query ID" /></label><label>Role<select value={role} onChange={(e) => setRole(e.target.value)}><option value="all">All roles</option><option>analyst</option><option>steward</option><option>auditor</option><option>admin</option></select></label></div>
      {!loading && !error && filtered.length === 0 && <p className="muted">No audit events match these filters.</p>}
      <div className="tablewrap">
        <table className="mono">
          <thead><tr><th>#</th><th>time (UTC)</th><th>actor</th><th>event</th><th>query</th></tr></thead>
          <tbody>
            {filtered.map((e) => (
              <Fragment key={e.id}><tr>
                <td><button className="sort-button" aria-expanded={expanded === e.id} onClick={() => setExpanded((v) => v === e.id ? null : e.id)}>{expanded === e.id ? "−" : "+"} {e.id}</button></td>
                <td>{e.ts.slice(0, 19).replace("T", " ")}</td>
                <td>{e.actor} ({e.actor_role})</td>
                <td>{e.event}</td>
                <td>{e.query_id ? e.query_id.slice(0, 8) : ""}</td>
              </tr>{expanded === e.id && <tr><td colSpan={5}><pre className="sql audit-payload">{JSON.stringify({ payload: e.payload ?? {}, hash: e.hash }, null, 2)}</pre></td></tr>}</Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
