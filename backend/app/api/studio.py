import time
from typing import Any

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth.deps import require_roles
from app.auth.models import DATA_ROLE, User
from app.db import connect
from app.governance import audit, policy
from app.governance.tools import MAX_ROWS, invoke
from app.pipeline import _jsonable
from app.validation.sql_validator import Rejected

router = APIRouter(prefix="/studio", tags=["studio"])
STUDIO_USERS = require_roles("analyst", "steward", "admin")


class SqlValidateIn(BaseModel):
    sql: str = Field(min_length=5, max_length=5000)


class SqlExecuteIn(BaseModel):
    sql: str = Field(min_length=5, max_length=5000)


@router.post("/validate")
def validate_sql_endpoint(body: SqlValidateIn, user: User = Depends(STUDIO_USERS)) -> dict[str, Any]:
    role = DATA_ROLE[user.role]
    sql = body.sql.strip()
    t0 = time.perf_counter()
    try:
        safe_sql = invoke("validate_sql", sql=sql, role=role)
        latency_ms = round((time.perf_counter() - t0) * 1000)
    except Rejected as e:
        return {
            "valid": False,
            "error": str(e),
            "safe_sql": None,
            "gate_reason": None,
            "latency_ms": round((time.perf_counter() - t0) * 1000),
        }

    # Check governance policy
    gate_reason = policy.approval_reason(safe_sql, role)
    sensitive_cols = policy.sensitive_columns_in(safe_sql)

    # Cost estimation
    cost = None
    try:
        cost = invoke("explain", sql=safe_sql, role=role)
    except psycopg.Error:
        cost = None

    return {
        "valid": True,
        "safe_sql": safe_sql,
        "gate_reason": gate_reason,
        "requires_approval": bool(gate_reason),
        "sensitive_columns": sensitive_cols,
        "estimated_cost": cost,
        "latency_ms": latency_ms,
    }


@router.post("/execute")
def execute_sql_endpoint(body: SqlExecuteIn, user: User = Depends(STUDIO_USERS)) -> dict[str, Any]:
    role = DATA_ROLE[user.role]
    sql = body.sql.strip()

    # Always enforce server-side validation first
    try:
        safe_sql = invoke("validate_sql", sql=sql, role=role)
    except Rejected as e:
        raise HTTPException(400, f"Policy violation: {e}")

    # Check if this query requires human approval
    reason = policy.approval_reason(safe_sql, role)
    if reason:
        raise HTTPException(
            403,
            f"This query requires human approval before execution ({reason}). Submit via the Copilot interface to request steward approval."
        )

    t0 = time.perf_counter()
    try:
        ex = invoke("execute_readonly", sql=safe_sql, role=role, max_rows=MAX_ROWS)
        latency_ms = round((time.perf_counter() - t0) * 1000)
    except psycopg.Error as e:
        raise HTTPException(400, f"Execution failed: {str(e).splitlines()[0]}")

    rows = [[_jsonable(cell) for cell in row] for row in ex.rows]

    # Audit log this studio execution
    with connect() as conn:
        audit.append("STUDIO_QUERY_EXECUTED", user.username, user.role, None, {
            "sql": safe_sql,
            "row_count": len(rows),
            "latency_ms": latency_ms,
            "truncated": ex.truncated,
        }, conn=conn)

    return {
        "sql": safe_sql,
        "columns": ex.columns,
        "rows": rows,
        "row_count": len(rows),
        "truncated": ex.truncated,
        "latency_ms": latency_ms,
    }
