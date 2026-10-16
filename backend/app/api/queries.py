import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import service
from app.auth.deps import require_roles
from app.auth.models import User
from app.db import connect

router = APIRouter(prefix="/queries", tags=["queries"])
ASKERS = require_roles("analyst", "steward", "admin")  # auditors cannot ask questions


class QueryIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)


@router.post("")
def create_query(body: QueryIn, user: User = Depends(ASKERS)) -> dict:
    return service.submit_query(user, body.question.strip())


@router.get("")
def my_history(user: User = Depends(ASKERS)) -> list[dict]:
    with connect() as conn:
        return conn.execute(
            "SELECT id, question, status, latency_ms, created_at FROM app.queries "
            "WHERE user_id = %s ORDER BY created_at DESC LIMIT 50", (user.id,)).fetchall()


@router.get("/{query_id}")
def get_query(query_id: str, user: User = Depends(ASKERS)) -> dict:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, question, status, sql, message, result_json, latency_ms, created_at "
            "FROM app.queries WHERE id = %s AND user_id = %s", (query_id, user.id)).fetchone()
    if row is None:  # same answer whether it doesn't exist or isn't yours
        raise HTTPException(404, "query not found")
    result = json.loads(row.pop("result_json")) if row["result_json"] else None
    return {**row, "result": result}