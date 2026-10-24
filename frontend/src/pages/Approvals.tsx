import { useCallback, useEffect, useState } from "react";
import { api, errorMessage, type Approval } from "../api";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function Sql({ text, sensitive }: { text: string; sensitive: string[] }) {
  if (sensitive.length === 0) return <pre className="sql">{text}</pre>;
  const re = new RegExp(`(${sensitive.map(escapeRe).join("|")})`, "gi");
  return (
    <pre className="sql">
      {text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part))}
    </pre>
  );
}

function Item({ a, onDone }: { a: Approval; onDone: (msg: string) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function act(kind: "approve" | "reject") {
    setBusy(true);
    setError("");
    try {
      const r = await api.decide(a.id, kind, reason.trim());
      onDone(`${kind === "approve" ? "Approved" : "Rejected"}: query is now ${r.query.status}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = reason.trim().length >= 5;
  return (
    <div className="card stack">
      <div><b>{a.question}</b></div>
      <div className="muted">Requested by {a.requested_by} · {a.gate_reason}</div>
      {a.sql && <Sql text={a.sql} sensitive={a.sensitive_columns} />}
      {a.can_decide ? (
        <>
          <input placeholder="Written reason (required, 5+ characters)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="row">
            <button disabled={busy || !ready} onClick={() => void act("approve")}>Approve</button>
            <button className="danger" disabled={busy || !ready} onClick={() => void act("reject")}>Reject</button>
          </div>
        </>
      ) : (
        <div className="badge warn">This is your own query, so another steward must decide it.</div>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export default function Approvals() {
  const [items, setItems] = useState<Approval[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await api.approvals());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <h1>Approvals</h1>
      <div className="row"><button className="ghost" onClick={() => void load()}>Refresh</button></div>
      {error && <p className="error">{error}</p>}
      {info && <p className="badge ok">{info}</p>}
      {items.length === 0 && !error && <p className="muted">Nothing is waiting for approval.</p>}
      {items.map((a) => (
        <Item key={a.id} a={a} onDone={(m) => { setInfo(m); void load(); }} />
      ))}
    </>
  );
}