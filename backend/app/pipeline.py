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
from app.generation.prompt import build_messages, render_context
from app.governance.tools import MAX_ROWS, invoke
from app.semantic.loader import compile_metric_template, load_semantic
from app.validation.grounding import claim_mismatch, result_row_answer, sanity_flags, ungrounded_numbers
from app.validation.sql_validator import Rejected
from app.variants import Variant, full_schema_context, strip_semantic

MAX_ATTEMPTS = 3

COMPLETED, BLOCKED, CLARIFY = "COMPLETED", "BLOCKED", "CLARIFY"
CANNOT_ANSWER, FAILED, PENDING_APPROVAL = "CANNOT_ANSWER", "FAILED", "PENDING_APPROVAL"
TIMEOUT = "TIMEOUT"

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
        return "The query returned no rows. No matching records were found for the specified filters."
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


def check_result_shape(question: str, rows: list) -> str | None:
    """Return an error hint if a scalar-aggregate question returned more than 1 row."""
    q = question.lower()
    keywords = ("how many", "total", "average")
    matched = next((kw for kw in keywords if kw in q), None)
    if not matched:
        return None
    grouping_signals = (" by ", " per ", " each ", " every ", "breakdown", "top ", "bottom ")
    padded = f" {q} "
    if any(sig in padded for sig in grouping_signals):
        return None
    if len(rows) > 1:
        return (
            f"Result shape check failed: question asks for scalar '{matched}', "
            f"expected 1 row but got {len(rows)} rows. Aggregate into a single row without grouping."
        )
    return None


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
    shape_retried = False

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
            if attempt == 1:
                res.status, res.message = CLARIFY, str(out.get("message", "Please clarify."))
                break
            # On attempt > 1, count as failed attempt and retry, never CLARIFY.
            sql_cand = out.get("sql")
            if not isinstance(sql_cand, str) or not sql_cand.strip():
                last_error, last_kind = "Clarification attempted during SQL repair with no valid SQL.", FAILED
                if attempt < MAX_ATTEMPTS:
                    repair_prompt = (
                        f"QUESTION: {question}\n"
                        f"FAILED SQL: None\n"
                        f"EXACT ERROR: {last_error}\n"
                        f"ALLOWED SCHEMA:\n{render_context(ctx)}\n\n"
                        'Fix the SQL. Reply with JSON with only a "sql" field, e.g. {"sql": "SELECT ..."}.'
                    )
                    messages.append({"role": "assistant", "content": json.dumps(out)})
                    messages.append({"role": "user", "content": repair_prompt})
                    continue
                break
        if status == "cannot_answer":
            if attempt == 1:
                res.status, res.message = CANNOT_ANSWER, str(out.get("message", "Not answerable."))
                break
            sql_cand = out.get("sql")
            if not isinstance(sql_cand, str) or not sql_cand.strip():
                last_error, last_kind = "cannot_answer returned during repair with no valid SQL.", FAILED
                if attempt < MAX_ATTEMPTS:
                    repair_prompt = (
                        f"QUESTION: {question}\n"
                        f"FAILED SQL: None\n"
                        f"EXACT ERROR: {last_error}\n"
                        f"ALLOWED SCHEMA:\n{render_context(ctx)}\n\n"
                        'Fix the SQL. Reply with JSON with only a "sql" field, e.g. {"sql": "SELECT ..."}.'
                    )
                    messages.append({"role": "assistant", "content": json.dumps(out)})
                    messages.append({"role": "user", "content": repair_prompt})
                    continue
                break

        # Check metric template first, fall back to normal generation
        metric_name = out.get("metric")
        sql: str | None = None
        if isinstance(metric_name, str) and metric_name.strip():
            raw_filters = out.get("filters")
            filters_list = [str(f) for f in raw_filters if f] if isinstance(raw_filters, list) else None
            sql = compile_metric_template(metric_name, filters_list)

        if not sql:
            raw_sql = out.get("sql")
            if isinstance(raw_sql, str) and raw_sql.strip():
                sql = raw_sql

        err: str | None = None
        kind = FAILED
        if not sql:
            err = "You returned no valid SQL."
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
                        err = f"Database error in governance gate: {str(e).splitlines()[0]}"

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
                        err_line = str(e).splitlines()[0] if str(e).strip() else type(e).__name__
                        if isinstance(e, psycopg.errors.QueryCanceled) or "statement timeout" in str(e).lower():
                            err = f"Query canceled due to statement timeout ({err_line}). Try filtering by a narrower date range or category."
                            kind = TIMEOUT
                            last_error, last_kind = err, kind
                            # Database timeouts should not be retried with the exact same slow query
                            break
                        else:
                            err = f"Database execution error: {err_line}"
                    else:
                        shape_hint = None
                        if not shape_retried:
                            shape_hint = check_result_shape(question, ex.rows)

                        if shape_hint:
                            shape_retried = True
                            err, kind = shape_hint, FAILED
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
        if attempt < MAX_ATTEMPTS:
            repair_prompt = (
                f"QUESTION: {question}\n"
                f"FAILED SQL: {sql or 'None'}\n"
                f"EXACT ERROR: {last_error}\n"
                f"ALLOWED SCHEMA:\n{render_context(ctx)}\n\n"
                'Fix the SQL. Reply with JSON with only a "sql" field, e.g. {"sql": "SELECT ..."}.'
            )
            messages.append({"role": "assistant", "content": json.dumps(out)})
            messages.append({"role": "user", "content": repair_prompt})

    if res.status not in (COMPLETED, CLARIFY, CANNOT_ANSWER, PENDING_APPROVAL, TIMEOUT):
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
