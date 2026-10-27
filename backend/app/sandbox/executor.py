import json
from dataclasses import dataclass
from typing import LiteralString, cast

import psycopg

from app.config import settings


@dataclass
class ExecResult:
    columns: list[str]
    rows: list[tuple]
    truncated: bool


def execute(sql: str, role: str, max_rows: int = 1000, timeout_ms: int | None = None) -> ExecResult:
    """Run SQL as the read-only DB role for `role` (read-only txn, statement timeout)."""
    t_ms = timeout_ms if timeout_ms is not None else settings.statement_timeout_ms
    with psycopg.connect(settings.role_conninfo(role, t_ms)) as conn:
        conn.read_only = True
        with conn.cursor() as cur:
            cur.execute(cast(LiteralString, sql))  # no params, so '%' in LIKE patterns is safe
            columns = [d.name for d in cur.description] if cur.description else []
            rows = cur.fetchmany(max_rows + 1)
        truncated = len(rows) >= max_rows  # the validator caps LIMIT at max_rows, so hitting it means "possibly cut"
    return ExecResult(columns, rows[:max_rows], truncated)


def explain_cost(sql: str, role: str, timeout_ms: int | None = None) -> float:
    """Planner's estimated total cost. Does not run the query, but also catches bad SQL."""
    t_ms = timeout_ms if timeout_ms is not None else settings.statement_timeout_ms
    with psycopg.connect(settings.role_conninfo(role, t_ms)) as conn:
        conn.read_only = True
        with conn.cursor() as cur:
            cur.execute(cast(LiteralString, f"EXPLAIN (FORMAT JSON) {sql}"))
            row = cur.fetchone()
            if not row:
                raise RuntimeError("EXPLAIN query returned no results")
            plan = row[0]
    if isinstance(plan, str):
        plan = json.loads(plan)
    return float(plan[0]["Plan"]["Total Cost"])