"""Approval gates: sensitive columns, many joins, high EXPLAIN cost."""
import sqlglot
from sqlglot import exp

from app.config import settings
from app.governance.tools import invoke
from app.semantic.loader import load_semantic


def pii_columns() -> set[str]:
    sem = load_semantic()
    return {c.lower() for t in sem.tables.values()
            for c, col in t.columns.items() if col.sensitivity == "pii"}


def sensitive_columns_in(sql: str) -> list[str]:
    tree = sqlglot.parse_one(sql, read="postgres")
    names = {c.name.lower() for c in tree.find_all(exp.Column)}
    return sorted(names & pii_columns())


def static_reasons(sql: str) -> list[str]:
    """Gate checks that need no database."""
    reasons: list[str] = []
    sens = sensitive_columns_in(sql)
    if sens:
        reasons.append(f"touches sensitive columns: {', '.join(sens)}")
    tree = sqlglot.parse_one(sql, read="postgres")
    joins = len(list(tree.find_all(exp.Join)))
    if joins >= settings.approval_join_threshold:
        reasons.append(f"uses {joins} joins")
    return reasons


def approval_reason(sql: str, role: str) -> str | None:
    """Return why a human must approve, or None if the query can run now.
    May raise psycopg.Error if EXPLAIN fails (the pipeline treats that as bad SQL)."""
    reasons = static_reasons(sql)
    cost = invoke("explain", sql=sql, role=role)
    if cost > settings.approval_cost_threshold:
        reasons.append(f"estimated cost {cost:,.0f} exceeds {settings.approval_cost_threshold:,.0f}")
    return "; ".join(reasons) or None