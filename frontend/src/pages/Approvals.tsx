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
  const [confirm, setConfirm] = useState<"approve" | "reject" | null>(null);

  async function act() {
    if (!confirm) return;
    const kind = confirm;
    setBusy(true);
    setError("");
    try {
      const r = await api.decide(a.id, kind, reason.trim());
      onDone(`${kind === "approve" ? "Approved" : "Rejected"}: query is now ${r.query.status}`);
      setConfirm(null);
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
          <div className="row">
            <button disabled={busy} onClick={() => setConfirm("approve")}>Approve</button>
            <button className="danger" disabled={busy} onClick={() => setConfirm("reject")}>Reject</button>
          </div>
        </>
      ) : (
        <div className="badge warn">This is your own query, so another steward must decide it.</div>
      )}
      {error && <div className="error">{error}</div>}
      {confirm && <dialog open className="confirm-dialog" aria-labelledby={`confirm-${a.id}`}>
        <h2 id={`confirm-${a.id}`}>{confirm === "approve" ? "Confirm approval" : "Confirm rejection"}</h2>
        <p>This request expires {new Date(a.expires_at).toLocaleString()}.</p>
        <label htmlFor={`reason-${a.id}`}>Decision comment (required)</label>
        <textarea id={`reason-${a.id}`} value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} required placeholder="Explain this decision (at least 5 characters)" />
        {error && <p role="alert" className="error">{error}</p>}
        <div className="row"><button disabled={busy || !ready} onClick={() => void act()}>{busy ? "Saving…" : `Confirm ${confirm}`}</button><button className="ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button></div>
      </dialog>}
    </div>
  );
}

export default function Approvals() {
  const [items, setItems] = useState<Approval[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await api.approvals());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void api.approvals().then((data) => {
      if (active) { setItems(data); setError(""); }
    }).catch((err: unknown) => {
      if (active) setError(errorMessage(err));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <>
      <h1>Approvals</h1>
      <div className="row"><button className="ghost" onClick={() => void load()}>Refresh</button></div>
      {loading && <div className="card skeleton" role="status" aria-label="Loading approvals"><span /><span /><span /></div>}
      {error && <p className="error">{error}</p>}
      {info && <p className="badge ok">{info}</p>}
      {items.length === 0 && !error && !loading && <p className="muted">Nothing is waiting for approval.</p>}
      {items.map((a) => (
        <Item key={a.id} a={a} onDone={(m) => { setInfo(m); void load(); }} />
      ))}
    </>
  );
}
