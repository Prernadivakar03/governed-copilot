from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import service
from app.auth.deps import require_roles
from app.auth.models import User
from app.db import connect
from app.governance import approvals, policy

router = APIRouter(prefix="/approvals", tags=["approvals"])
DECIDERS = require_roles("steward", "admin")


class DecisionIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


@router.get("")
def pending(user: User = Depends(DECIDERS)) -> list[dict]:
    with connect() as conn:
        approvals.expire_stale(conn)
        rows = conn.execute(
            """SELECT a.id, a.query_id, a.gate_reason, a.created_at, a.expires_at,
                      u.username AS requested_by, (a.requested_by <> %s) AS can_decide,
                      q.question, q.sql
               FROM app.approvals a
               JOIN app.users u ON u.id = a.requested_by
               JOIN app.queries q ON q.id = a.query_id
               WHERE a.status = 'PENDING' ORDER BY a.created_at""", (user.id,)).fetchall()
    for r in rows:
        r["sensitive_columns"] = policy.sensitive_columns_in(r["sql"]) if r["sql"] else []
    return rows


def _decide(approval_id: int, decision: str, body: DecisionIn, user: User) -> dict:
    try:
        return service.decide_approval(user, approval_id, decision, body.reason)
    except approvals.ApprovalError as e:
        raise HTTPException(e.code, str(e))


@router.post("/{approval_id}/approve")
def approve(approval_id: int, body: DecisionIn, user: User = Depends(DECIDERS)) -> dict:
    return _decide(approval_id, "approve", body, user)


@router.post("/{approval_id}/reject")
def reject(approval_id: int, body: DecisionIn, user: User = Depends(DECIDERS)) -> dict:
    return _decide(approval_id, "reject", body, user)