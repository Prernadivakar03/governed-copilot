from __future__ import annotations

import json
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

import psycopg

from app.config import settings
from app.generation.llm import LLMError
from app.generation.prompt import build_messages
from app.governance.tools import MAX_ROWS, invoke
from app.semantic.loader import load_semantic
from app.validation.grounding import claim_mismatch, result_row_answer, sanity_flags, ungrounded_numbers
from app.validation.sql_validator import Rejected
from app.variants import Variant, full_schema_context, strip_semantic

MAX_ATTEMPTS = 3

COMPLETED, BLOCKED, CLARIFY = "COMPLETED", "BLOCKED", "CLARIFY"
CANNOT_ANSWER, FAILED, PENDING_APPROVAL = "CANNOT_ANSWER", "FAILED", "PENDING_APPROVAL"

# gate(safe_sql, db_role) -> reason string if a human must approve, else None
Gate = Callable[[str, str], str | None]


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
    notes: list[str] = field(default_factory=list)
    flags: list[str] = field(default_factory=list)
    hallucination_flag: bool = False
    claim_mismatch: bool = False
    attempts: int = 0
    events: list[dict] = field(default_factory=list)
    latency_ms: int = 0


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


def _cite(res: QueryResult, out: dict, ctx) -> None:
    raw = out.get("source_ids")
    cited = [s for s in raw if isinstance(s, str)] if isinstance(raw, list) else []
    res.source_ids = [s for s in cited if s in ctx.source_ids]
    res.invalid_citations = [s for s in cited if s not in ctx.source_ids]


def _llm_answer(res: QueryResult, event: Callable[..., None]) -> None:
    """Replace the templated answer with an LLM one, but only if every number is grounded."""
    if not (settings.llm_answer and res.rows):
        return
    t0 = time.perf_counter()
    try:
        out = invoke("summarize", question=res.question, columns=res.columns,
                     rows=res.rows, truncated=res.truncated)
    except LLMError as e:
        event("summarize", t0, error=str(e))
        return
    text = out.get("answer")
    if not isinstance(text, str) or not text.strip():
        event("summarize", t0, verdict="empty")
        return
    bad = ungrounded_numbers(text, res.columns, res.rows, res.question)
    if bad:
        res.hallucination_flag = True
        res.flags.append("draft answer had numbers not in the result: "
                         + ", ".join(f"{b:g}" for b in bad))
        event("summarize", t0, verdict="ungrounded")
        return
    if claim_mismatch(text, res.columns, res.rows):
        res.claim_mismatch = True
        res.flags.append("claim_mismatch")
        res.answer = result_row_answer(res.columns, res.rows)
        event("summarize", t0, verdict="claim_mismatch")
        return
    res.answer = text.strip()
    event("summarize", t0, verdict="grounded")


def run_query(question: str, role: str, gate: Gate | None = None,
              retrieval_mode: str | None = None,
              on_event: Callable[[dict], None] | None = None,
              variant: Variant | None = None) -> QueryResult:
    """role is the DATABASE role ('analyst' or 'steward')."""
    v = variant or Variant("default", retrieval=retrieval_mode or settings.retrieval_mode)
    t_start = time.perf_counter()
    res = QueryResult(question=question, role=role)

    def event(stage: str, t0: float, **detail: Any) -> None:
        ev = {"stage": stage, "ms": round((time.perf_counter() - t0) * 1000), **detail}
        res.events.append(ev)
        if on_event is not None:
            on_event(ev)

    t0 = time.perf_counter()
    if v.retrieval == "full_schema":
        ctx = full_schema_context(load_semantic())
    else:
        ctx = invoke("retrieve", question=question,
                     role=role if v.permissions else "steward", mode=v.retrieval)
    if not v.semantic:
        ctx = strip_semantic(ctx)
    res.notes = list(ctx.notes)
    event("retrieve", t0, mode=ctx.mode, tables=list(ctx.tables),
          metrics=list(ctx.metrics), notes=res.notes)

    messages = build_messages(question, ctx)
    last_error, last_kind = "no attempt made", FAILED

    for attempt in range(1, MAX_ATTEMPTS + 1):
        res.attempts = attempt

        t0 = time.perf_counter()
        try:
            out = invoke("generate_sql", messages=messages)
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
        kind = FAILED
        if not isinstance(sql, str) or not sql.strip():
            err = "You returned no SQL."
        else:
            t0 = time.perf_counter()
            try:
                safe_sql = invoke("validate_sql", sql=sql, role=role)
                event("validate", t0, verdict="pass")
            except Rejected as e:
                event("validate", t0, verdict="reject", reason=str(e))
                err, kind = f"Validator rejected the SQL: {e}", BLOCKED
            else:
                reason: str | None = None
                if gate is not None:
                    t0 = time.perf_counter()
                    try:
                        reason = gate(safe_sql, role)
                        event("gate", t0, approval_required=bool(reason))
                    except psycopg.Error as e:
                        event("gate", t0, error=type(e).__name__)
                        err = f"Database error: {str(e).splitlines()[0]}"

                if err is None and reason:
                    _cite(res, out, ctx)
                    res.sql, res.status, res.message = safe_sql, PENDING_APPROVAL, reason
                    break
                if err is None:
                    t0 = time.perf_counter()
                    try:
                        ex = invoke("execute_readonly", sql=safe_sql, role=role, max_rows=MAX_ROWS)
                        event("execute", t0, rows=len(ex.rows))
                    except psycopg.Error as e:
                        event("execute", t0, error=type(e).__name__)
                        err = f"Database error: {str(e).splitlines()[0]}"
                    else:
                        _cite(res, out, ctx)
                        res.sql = safe_sql
                        res.columns = ex.columns
                        res.rows = [[_jsonable(v) for v in row] for row in ex.rows]
                        res.truncated = ex.truncated
                        res.answer = _simple_answer(res.columns, res.rows, res.truncated)
                        res.flags = sanity_flags(res.columns, res.rows, res.truncated)
                        _llm_answer(res, event)
                        res.status = COMPLETED
                        break

        last_error, last_kind = err or "unknown", kind
        messages.append({"role": "assistant", "content": json.dumps(out)})
        messages.append({"role": "user", "content":
                         f"{last_error} Fix the query and reply with JSON again."})

    if res.status not in (COMPLETED, CLARIFY, CANNOT_ANSWER, PENDING_APPROVAL):
        res.status, res.message = last_kind, last_error

    res.latency_ms = round((time.perf_counter() - t_start) * 1000)
    return res


def execute_approved(sql: str, role: str) -> dict:
    """Run SQL that a human approved. Re-validates first: approval never skips the validator."""
    safe_sql = invoke("validate_sql", sql=sql, role=role)
    ex = invoke("execute_readonly", sql=safe_sql, role=role, max_rows=MAX_ROWS)
    rows = [[_jsonable(cell) for cell in row] for row in ex.rows]
    return {"columns": ex.columns, "rows": rows, "truncated": ex.truncated,
            "answer": _simple_answer(ex.columns, rows, ex.truncated)}
