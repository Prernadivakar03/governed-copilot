"""Append-only, hash-chained audit log.

Each row's hash covers the previous row's hash, so changing or deleting any middle row
breaks every later link. This is tamper-EVIDENT, not tamper-proof: someone with full DB
admin rights could rewrite the entire chain. Export the head hash (from /audit/verify)
somewhere outside the database to detect that.
"""
import hashlib
import json
import re
from datetime import datetime, timezone
from typing import Any

from app.db import connect

GENESIS = "0" * 64
LOCK_ID = 727001  # serialises writers so the chain never forks

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE = re.compile(r"\+?\d[\d\-\s()]{7,}\d")


def mask(text: str) -> str:
    return _PHONE.sub("[phone]", _EMAIL.sub("[email]", text))


def _mask_obj(obj: Any) -> Any:
    if isinstance(obj, str):
        return mask(obj)
    if isinstance(obj, dict):
        return {k: _mask_obj(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_mask_obj(v) for v in obj]
    return obj


def compute_hash(prev: str, ts: str, actor: str, actor_role: str,
                 event: str, query_id: str | None, payload: str) -> str:
    preimage = json.dumps([prev, ts, actor, actor_role, event, query_id or "", payload])
    return hashlib.sha256(preimage.encode()).hexdigest()


def append(event: str, actor: str, actor_role: str, query_id: str | None = None,
           payload: dict | None = None, conn=None) -> str:
    """Add one record and return its hash. Pass `conn` to join the caller's transaction."""
    body = json.dumps(_mask_obj(payload or {}), sort_keys=True, default=str,
                      separators=(",", ":"))
    ts = datetime.now(timezone.utc).isoformat(timespec="microseconds")

    def _write(c) -> str:
        c.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_ID,))
        last = c.execute("SELECT hash FROM app.audit_log ORDER BY id DESC LIMIT 1").fetchone()
        prev = last["hash"] if last else GENESIS
        h = compute_hash(prev, ts, actor, actor_role, event, query_id, body)
        c.execute(
            """INSERT INTO app.audit_log
               (ts, actor, actor_role, event, query_id, payload, prev_hash, hash)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (ts, actor, actor_role, event, query_id, body, prev, h),
        )
        return h

    if conn is not None:
        return _write(conn)
    with connect() as c:
        return _write(c)


def verify_chain(conn=None) -> dict:
    def _read(c):
        return c.execute("SELECT * FROM app.audit_log ORDER BY id").fetchall()

    if conn is not None:
        rows = _read(conn)
    else:
        with connect() as c:
            rows = _read(c)

    prev = GENESIS
    for n, r in enumerate(rows):
        if r["prev_hash"] != prev:
            return {"ok": False, "checked": n, "broken_at": r["id"], "reason": "link broken"}
        expected = compute_hash(r["prev_hash"], r["ts"], r["actor"], r["actor_role"],
                                r["event"], r["query_id"], r["payload"])
        if expected != r["hash"]:
            return {"ok": False, "checked": n, "broken_at": r["id"], "reason": "content changed"}
        prev = r["hash"]
    return {"ok": True, "checked": len(rows), "head": prev}