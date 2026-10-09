from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from functools import lru_cache
from typing import Any

import psycopg

from app.generation.llm import LLMError, OllamaClient
from app.generation.prompt import build_messages
from app.retrieval.retriever import Retriever
from app.sandbox.executor import execute
from app.semantic.loader import allowed_map, load_semantic, restricted_names
from app.validation.sql_validator import Rejected, validate

MAX_ATTEMPTS = 3
MAX_ROWS = 1000

COMPLETED, BLOCKED, CLARIFY = "COMPLETED", "BLOCKED", "CLARIFY"
CANNOT_ANSWER, FAILED = "CANNOT_ANSWER", "FAILED"


@dataclass
class QueryResult:
    status: str = FAILED
    question: str = ""
    role: str = ""
    sql: str | None = None
    columns: list[str] = field(default_factory=list)
    rows: list[list[Any]] = field(default_factory=list)
    truncated: bool = False
    answer: str | None = None
    message: str | None = None
    source_ids: list[str] = field(default_factory=list)
    invalid_citations: list[str] = field(default_factory=list)
    attempts: int = 0
    events: list[dict] = field(default_factory=list)
    latency_ms: int = 0


@lru_cache
def _retriever(role: str) -> Retriever:
    return Retriever(load_semantic(), role)


@lru_cache
def _llm() -> OllamaClient:
    return OllamaClient()


def _jsonable(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v


def _simple_answer(columns: list[str], rows: list[list[Any]], truncated: bool) -> str:
    if not rows:
        return "The query returned no rows."
    if len(rows) == 1 and len(columns) == 1:
        return f"{columns[0]}: {rows[0][0]}"
    note = " (truncated)" if truncated else ""
    return f"{len(rows)} rows returned{note}."


def run_query(question: str, role: str) -> QueryResult:
    t_start = time.perf_counter()
    res = QueryResult(question=question, role=role)

    def event(stage: str, t0: float, **detail: Any) -> None:
        res.events.append({"stage": stage, "ms": round((time.perf_counter() - t0) * 1000), **detail})

    sem = load_semantic()
    allowed = allowed_map(sem, role)
    restricted = restricted_names(sem, role)

    t0 = time.perf_counter()
    ctx = _retriever(role).context(question)
    event("retrieve", t0, tables=list(ctx.tables), metrics=list(ctx.metrics))

    messages = build_messages(question, ctx)
    last_error, last_kind = "no attempt made", FAILED

    for attempt in range(1, MAX_ATTEMPTS + 1):
        res.attempts = attempt

        t0 = time.perf_counter()
        try:
            out = _llm().chat_json(messages)
        except LLMError as e:
            event("generate", t0, error=str(e))
            last_error, last_kind = str(e), FAILED
            break
        event("generate", t0, status=out.get("status"))

        status = out.get("status", "ok")
        if status == "clarify":
            res.status, res.message = CLARIFY, str(out.get("message", "Please clarify."))
            break
        if status == "cannot_answer":
            res.status, res.message = CANNOT_ANSWER, str(out.get("message", "Not answerable."))
            break

        sql = out.get("sql")
        err: str | None = None
        if not isinstance(sql, str) or not sql.strip():
            err, kind = "You returned no SQL.", FAILED
        else:
            t0 = time.perf_counter()
            try:
                safe_sql = validate(sql, allowed, restricted, MAX_ROWS)
                event("validate", t0, verdict="pass")
            except Rejected as e:
                event("validate", t0, verdict="reject", reason=str(e))
                err, kind = f"Validator rejected the SQL: {e}", BLOCKED
            else:
                t0 = time.perf_counter()
                try:
                    ex = execute(safe_sql, role, MAX_ROWS)
                    event("execute", t0, rows=len(ex.rows))
                except psycopg.Error as e:
                    event("execute", t0, error=type(e).__name__)
                    err, kind = f"Database error: {str(e).splitlines()[0]}", FAILED
                else:
                    cited = [s for s in out.get("source_ids", []) if isinstance(s, str)]
                    res.source_ids = [s for s in cited if s in ctx.source_ids]
                    res.invalid_citations = [s for s in cited if s not in ctx.source_ids]
                    res.sql = safe_sql
                    res.columns = ex.columns
                    res.rows = [[_jsonable(v) for v in row] for row in ex.rows]
                    res.truncated = ex.truncated
                    res.answer = _simple_answer(res.columns, res.rows, res.truncated)
                    res.status = COMPLETED
                    break

        last_error, last_kind = err or "unknown", kind
        messages.append({"role": "assistant", "content": json.dumps(out)})
        messages.append({"role": "user", "content":
                         f"{last_error} Fix the query and reply with JSON again."})

    if res.status not in (COMPLETED, CLARIFY, CANNOT_ANSWER):
        res.status, res.message = last_kind, last_error

    res.latency_ms = round((time.perf_counter() - t_start) * 1000)
    return res