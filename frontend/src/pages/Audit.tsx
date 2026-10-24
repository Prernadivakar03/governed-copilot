import { useEffect, useState } from "react";
import { api, errorMessage, type AuditEvent, type AuditVerify } from "../api";

export default function Audit() {
  const [verify, setVerify] = useState<AuditVerify | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [v, e] = await Promise.all([api.auditVerify(), api.auditEvents()]);
        setVerify(v);
        setEvents(e);
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, []);

  return (
    <>
      <h1>Audit log</h1>
      {error && <p className="error">{error}</p>}
      {verify && (
        <p>
          <span className={`badge ${verify.ok ? "ok" : "bad"}`}>
            {verify.ok ? `chain intact · ${verify.checked} records` : `chain broken at #${verify.broken_at}: ${verify.reason}`}
          </span>
          {verify.head && <span className="muted mono"> head {verify.head.slice(0, 16)}…</span>}
        </p>
      )}
      <div className="tablewrap">
        <table className="mono">
          <thead><tr><th>#</th><th>time (UTC)</th><th>actor</th><th>event</th><th>query</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.ts.slice(0, 19).replace("T", " ")}</td>
                <td>{e.actor} ({e.actor_role})</td>
                <td>{e.event}</td>
                <td>{e.query_id ? e.query_id.slice(0, 8) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}