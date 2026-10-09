"""Validate LLM-written SQL. The LLM is never the security boundary."""
from __future__ import annotations

import sqlglot
from sqlglot import exp

SCHEMA = "analytics"

BLOCKED_FUNCS = {
    "current_setting", "set_config", "dblink", "dblink_exec", "copy",
    "query_to_xml", "table_to_xml", "xpath", "version", "current_user",
    "session_user", "inet_server_addr", "txid_current",
}
BLOCKED_PREFIXES = ("pg_", "lo_", "dblink")

_FORBIDDEN_NODES = tuple(
    getattr(exp, n)
    for n in ("Insert", "Update", "Delete", "Create", "Drop", "Command", "Alter",
              "AlterTable", "Merge", "Set", "Copy", "Grant")
    if hasattr(exp, n)
)


class Rejected(Exception):
    """SQL violates policy."""


def validate(
    sql: str,
    allowed: dict[str, set[str]],
    restricted: frozenset[str] = frozenset(),
    max_rows: int = 1000,
) -> str:
    """Return safe SQL (with LIMIT enforced) or raise Rejected."""
    sql = sql.strip().rstrip(";").strip()
    if not sql:
        raise Rejected("empty query")
    if "--" in sql or "/*" in sql:
        raise Rejected("comments are not allowed")
    if ";" in sql:
        raise Rejected("multiple statements are not allowed")

    try:
        tree = sqlglot.parse_one(sql, read="postgres")
    except sqlglot.errors.SqlglotError as e:
        raise Rejected(f"cannot parse SQL: {str(e)[:120]}") from e

    if not isinstance(tree, exp.Select):
        raise Rejected("only a single SELECT statement is allowed")
    if tree.args.get("into") or tree.args.get("locks"):
        raise Rejected("SELECT INTO / locking clauses are not allowed")
    for node in tree.walk():
        if isinstance(node, _FORBIDDEN_NODES):
            raise Rejected(f"forbidden operation: {type(node).__name__}")

    # SELECT * and t.* hide which columns are read
    for star in tree.find_all(exp.Star):
        if not isinstance(star.parent, exp.Count):
            raise Rejected("SELECT * is not allowed; list the columns you need")

    # tables
    cte_names = {c.alias.lower() for c in tree.find_all(exp.CTE)}
    alias_map: dict[str, set[str]] = {}
    query_tables: set[str] = set()
    for t in tree.find_all(exp.Table):
        name = t.name.lower()
        if not t.db and name in cte_names:
            continue
        if t.db and t.db.lower() != SCHEMA:
            raise Rejected(f"schema not permitted: {t.db}")
        if name not in allowed:
            raise Rejected(f"table not permitted: {name or '(function or unknown)'}")
        query_tables.add(name)
        alias_map.setdefault((t.alias_or_name or name).lower(), set()).add(name)

    # functions
    for f in tree.find_all(exp.Func):
        fname = (f.name if isinstance(f, exp.Anonymous) else f.sql_name()).lower()
        if fname in BLOCKED_FUNCS or fname.startswith(BLOCKED_PREFIXES):
            raise Rejected(f"function blocked: {fname}")

    # aliases must not shadow restricted columns
    aliases = {a.alias.lower() for a in tree.find_all(exp.Alias) if a.alias}
    bad_alias = aliases & restricted
    if bad_alias:
        raise Rejected(f"alias not permitted: {sorted(bad_alias)[0]}")

    # columns
    union_allowed = {c for t in query_tables for c in allowed[t]}
    for col in tree.find_all(exp.Column):
        cname = col.name.lower()
        qualifier = col.table.lower()
        if qualifier:
            tables = alias_map.get(qualifier)
            if tables is None:
                continue  # subquery/CTE alias; inner columns were checked on their own
            for t in tables:
                if cname not in allowed[t]:
                    raise Rejected(f"column not permitted: {qualifier}.{cname}")
        else:
            if cname in union_allowed:
                continue
            if cname in aliases and cname not in restricted:
                continue
            raise Rejected(f"column not permitted or unknown: {cname}")

    # row cap
    limit = tree.args.get("limit")
    value = limit.expression if limit is not None else None
    if not (isinstance(value, exp.Literal) and value.is_int and int(value.this) <= max_rows):
        tree = tree.limit(max_rows)

    return tree.sql(dialect="postgres")