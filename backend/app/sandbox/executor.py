from dataclasses import dataclass

import psycopg

from app.config import settings


@dataclass
class ExecResult:
    columns: list[str]
    rows: list[tuple]
    truncated: bool


def execute(sql: str, role: str, max_rows: int = 1000, timeout_ms: int = 5000) -> ExecResult:
    """Run SQL as the read-only DB role for `role` (read-only txn, statement timeout)."""
    with psycopg.connect(settings.role_conninfo(role, timeout_ms)) as conn:
        conn.read_only = True
        with conn.cursor() as cur:
            cur.execute(sql)  # no params, so '%' in LIKE patterns is safe
            columns = [d.name for d in cur.description] if cur.description else []
            rows = cur.fetchmany(max_rows + 1)
    truncated = len(rows) > max_rows
    return ExecResult(columns, rows[:max_rows], truncated)