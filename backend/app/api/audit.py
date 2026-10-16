import json

from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth.deps import require_roles
from app.auth.models import User
from app.db import connect
from app.governance import audit as audit_log

router = APIRouter(prefix="/audit", tags=["audit"])
READERS = require_roles("auditor", "admin")  # read-only: no endpoint can edit or delete


def _row(r: dict) -> dict:
    return {**r, "payload": json.loads(r["payload"])}


@router.get("/events")
def events(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0),
           user: User = Depends(READERS)) -> list[dict]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM app.audit_log ORDER BY id DESC LIMIT %s OFFSET %s",
                            (limit, offset)).fetchall()
    return [_row(r) for r in rows]


@router.get("/events/{event_id}")
def one_event(event_id: int, user: User = Depends(READERS)) -> dict:
    with connect() as conn:
        r = conn.execute("SELECT * FROM app.audit_log WHERE id = %s", (event_id,)).fetchone()
    if r is None:
        raise HTTPException(404, "event not found")
    return _row(r)


@router.get("/verify")
def verify(user: User = Depends(READERS)) -> dict:
    return audit_log.verify_chain()