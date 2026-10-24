import json
import logging
import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app import events, service
from app.auth.deps import require_roles
from app.auth.models import User
from app.db import connect

log = logging.getLogger(__name__)
router = APIRouter(prefix="/queries", tags=["queries"])
ASKERS = require_roles("analyst", "steward", "admin")  # auditors cannot ask questions


class QueryIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)


def _run_in_background(user: User, question: str, qid: str) -> None:
    status = "FAILED"
    try:
        out = service.process_query(user, question, qid,
                                    on_event=lambda e: events.publish(qid, e))
        status = out["status"]
    except Exception:
        log.exception("query %s failed", qid)
    finally:
        events.publish(qid, {"stage": "done", "status": status})
        events.finish(qid)


@router.post("")
def create_query(body: QueryIn, background: BackgroundTasks, stream: bool = False,
                 user: User = Depends(ASKERS)) -> dict:
    """stream=false: wait and return the full result. stream=true: return a query_id at once;
    watch progress on GET /queries/{id}/events, then read GET /queries/{id}."""
    question = body.question.strip()
    if not stream:
        return service.submit_query(user, question)
    qid = service.create_query(user, question)
    events.open_query(qid)
    background.add_task(_run_in_background, user, question, qid)
    return {"query_id": qid, "status": "RECEIVED"}


@router.get("")
def my_history(user: User = Depends(ASKERS)) -> list[dict]:
    with connect() as conn:
        return conn.execute(
            "SELECT id, question, status, latency_ms, created_at FROM app.queries "
            "WHERE user_id = %s ORDER BY created_at DESC LIMIT 50", (user.id,)).fetchall()


@router.get("/{query_id}/events")
def stream_events(query_id: str, user: User = Depends(ASKERS)) -> StreamingResponse:
    with connect() as conn:
        owns = conn.execute("SELECT 1 FROM app.queries WHERE id = %s AND user_id = %s",
                            (query_id, user.id)).fetchone()
    if owns is None:
        raise HTTPException(404, "query not found")

    def gen():
        sent, deadline = 0, time.time() + 300
        while time.time() < deadline:
            evs, done = events.snapshot(query_id, sent)
            for e in evs:
                yield f"data: {json.dumps(e, default=str)}\n\n"
            sent += len(evs)
            if done:
                return
            time.sleep(0.2)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


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