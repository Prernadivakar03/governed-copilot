import json
import uuid
from dataclasses import asdict

import psycopg

from app.auth.models import DATA_ROLE, User
from app.config import settings
from app.db import connect
from app.governance import approvals, audit
from app.governance.policy import approval_reason
from app.pipeline import COMPLETED, PENDING_APPROVAL, execute_approved, run_query
from app.validation.sql_validator import Rejected


def submit_query(user: User, question: str) -> dict:
    qid = uuid.uuid4().hex
    data_role = DATA_ROLE[user.role]

    with connect() as conn:
        conn.execute(
            "INSERT INTO app.queries (id, user_id, question, data_role, status) "
            "VALUES (%s, %s, %s, %s, 'RECEIVED')", (qid, user.id, question, data_role))
        audit.append("QUERY_RECEIVED", user.username, user.role, qid,
                     {"question": question}, conn=conn)

    try:
        res = run_query(question, data_role, gate=approval_reason)
    except Exception as e:
        with connect() as conn:
            conn.execute("UPDATE app.queries SET status = 'FAILED', message = %s, "
                         "updated_at = now() WHERE id = %s", (type(e).__name__, qid))
            audit.append("QUERY_OUTCOME", user.username, user.role, qid,
                         {"status": "FAILED", "error": type(e).__name__}, conn=conn)
        raise

    result_json = None
    if res.status == COMPLETED:
        result_json = json.dumps({"columns": res.columns, "rows": res.rows,
                                  "truncated": res.truncated, "answer": res.answer})

    with connect() as conn:
        conn.execute(
            "UPDATE app.queries SET status = %s, sql = %s, message = %s, result_json = %s, "
            "latency_ms = %s, updated_at = now() WHERE id = %s",
            (res.status, res.sql, res.message, result_json, res.latency_ms, qid))
        if res.status == PENDING_APPROVAL:
            aid = approvals.create_pending(conn, qid, user.id, res.message or "",
                                           settings.approval_ttl_minutes)
            audit.append("APPROVAL_REQUESTED", user.username, user.role, qid,
                         {"approval_id": aid, "reason": res.message, "sql": res.sql}, conn=conn)
        audit.append("QUERY_OUTCOME", user.username, user.role, qid, {
            "question": question,
            "status": res.status,
            "message": res.message,
            "sql": res.sql,
            "source_ids": res.source_ids,
            "retrieved_tables": next((e.get("tables") for e in res.events
                                      if e["stage"] == "retrieve"), []),
            "validator": [e for e in res.events if e["stage"] == "validate"],
            "attempts": res.attempts,
            "latency_ms": res.latency_ms,
        }, conn=conn)

    out = asdict(res)
    out["query_id"] = qid
    return out


def _execute_after_approval(query_id: str, approver: User) -> None:
    with connect() as conn:  # atomic claim: only one caller can move APPROVED -> EXECUTING
        row = conn.execute(
            "UPDATE app.queries SET status = 'EXECUTING', updated_at = now() "
            "WHERE id = %s AND status = 'APPROVED' RETURNING sql, data_role", (query_id,)
        ).fetchone()
    if row is None:
        return

    status, message, result_json, n_rows = "COMPLETED", None, None, 0
    try:
        result = execute_approved(row["sql"], row["data_role"])
        result_json, n_rows = json.dumps(result), len(result["rows"])
    except Rejected as e:
        status, message = "BLOCKED", f"validator rejected at execution time: {e}"
    except psycopg.Error as e:
        status, message = "FAILED", f"database error: {str(e).splitlines()[0]}"

    with connect() as conn:
        conn.execute("UPDATE app.queries SET status = %s, message = %s, result_json = %s, "
                     "updated_at = now() WHERE id = %s", (status, message, result_json, query_id))
        audit.append("EXECUTED_AFTER_APPROVAL", approver.username, approver.role, query_id,
                     {"status": status, "message": message, "rows": n_rows}, conn=conn)


def decide_approval(user: User, approval_id: int, decision: str, reason: str) -> dict:
    """decision: 'approve' or 'reject'."""
    status = "APPROVED" if decision == "approve" else "REJECTED"
    try:
        with connect() as conn:
            out = approvals.decide(conn, approval_id, user, status, reason)
    except approvals.ApprovalError as e:
        # the failed transaction rolled back, so record the denied attempt on its own
        audit.append("APPROVAL_ATTEMPT_DENIED", user.username, user.role, None,
                     {"approval_id": approval_id, "attempted": status,
                      "error": type(e).__name__, "detail": str(e)})
        raise

    if out["outcome"] == "expired":
        raise approvals.Expired("this approval has expired")
    if status == "APPROVED" and out["outcome"] == "decided":
        _execute_after_approval(out["query_id"], user)

    with connect() as conn:
        q = conn.execute("SELECT id, status, message FROM app.queries WHERE id = %s",
                         (out["query_id"],)).fetchone()
    return {"approval_id": approval_id, "decision": status, "outcome": out["outcome"], "query": q}