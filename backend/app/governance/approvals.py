"""Server-side approval state machine. The UI is never trusted to enforce any of this.

PENDING -> APPROVED | REJECTED | EXPIRED, each decided at most once.
Rules: written reason, steward/admin only, never your own query, idempotent repeats.
"""
from app.auth.models import User
from app.governance import audit

APPROVER_ROLES = ("steward", "admin")
MIN_REASON = 5


class ApprovalError(Exception):
    code = 400


class NotFound(ApprovalError):
    code = 404


class Forbidden(ApprovalError):
    code = 403


class SelfApproval(Forbidden):
    pass


class AlreadyDecided(ApprovalError):
    code = 409


class Expired(ApprovalError):
    code = 409


class InvalidTransition(ApprovalError):
    code = 409


class ReasonRequired(ApprovalError):
    code = 422


def create_pending(conn, query_id: str, requested_by: int, reason: str, ttl_minutes: int) -> int:
    row = conn.execute(
        """INSERT INTO app.approvals (query_id, requested_by, gate_reason, status, expires_at)
           VALUES (%s, %s, %s, 'PENDING', now() + (%s::int * interval '1 minute'))
           RETURNING id""",
        (query_id, requested_by, reason, ttl_minutes),
    ).fetchone()
    return row["id"]


def expire_stale(conn) -> int:
    rows = conn.execute(
        """UPDATE app.approvals SET status = 'EXPIRED', decided_at = now()
           WHERE status = 'PENDING' AND expires_at < now() RETURNING id, query_id"""
    ).fetchall()
    for r in rows:
        conn.execute(
            "UPDATE app.queries SET status = 'EXPIRED', updated_at = now() "
            "WHERE id = %s AND status = 'PENDING_APPROVAL'", (r["query_id"],))
        audit.append("APPROVAL_EXPIRED", "system", "system", r["query_id"],
                     {"approval_id": r["id"]}, conn=conn)
    return len(rows)


def decide(conn, approval_id: int, approver: User, decision: str, reason: str) -> dict:
    """decision is 'APPROVED' or 'REJECTED'. Returns {'outcome': decided|unchanged|expired, 'query_id'}.
    Raises ApprovalError subclasses on violations."""
    if decision not in ("APPROVED", "REJECTED"):
        raise ValueError(decision)
    reason = (reason or "").strip()
    if len(reason) < MIN_REASON:
        raise ReasonRequired(f"a written reason of at least {MIN_REASON} characters is required")
    if approver.role not in APPROVER_ROLES:
        raise Forbidden("your role cannot decide approvals")

    row = conn.execute(
        """SELECT id, query_id, requested_by, status, decided_by, (expires_at < now()) AS is_expired
           FROM app.approvals WHERE id = %s FOR UPDATE""",  # row lock: one decision at a time
        (approval_id,),
    ).fetchone()
    if row is None:
        raise NotFound("approval not found")
    if row["requested_by"] == approver.id:
        raise SelfApproval("you cannot decide your own query")

    if row["status"] != "PENDING":
        if row["status"] == decision and row["decided_by"] == approver.id:
            return {"outcome": "unchanged", "query_id": row["query_id"]}  # idempotent repeat
        raise AlreadyDecided(f"approval already {row['status'].lower()}")

    if row["is_expired"]:
        conn.execute("UPDATE app.approvals SET status = 'EXPIRED', decided_at = now() "
                     "WHERE id = %s", (approval_id,))
        conn.execute("UPDATE app.queries SET status = 'EXPIRED', updated_at = now() "
                     "WHERE id = %s AND status = 'PENDING_APPROVAL'", (row["query_id"],))
        audit.append("APPROVAL_EXPIRED", "system", "system", row["query_id"],
                     {"approval_id": approval_id}, conn=conn)
        return {"outcome": "expired", "query_id": row["query_id"]}

    conn.execute(
        """UPDATE app.approvals SET status = %s, decided_by = %s, decision_reason = %s,
           decided_at = now() WHERE id = %s""",
        (decision, approver.id, reason, approval_id),
    )
    changed = conn.execute(
        "UPDATE app.queries SET status = %s, updated_at = now() "
        "WHERE id = %s AND status = 'PENDING_APPROVAL'",
        (decision, row["query_id"]),
    ).rowcount
    if changed != 1:
        raise InvalidTransition("query is not awaiting approval")
    audit.append("APPROVAL_DECISION", approver.username, approver.role, row["query_id"],
                 {"approval_id": approval_id, "decision": decision, "reason": reason}, conn=conn)
    return {"outcome": "decided", "query_id": row["query_id"]}