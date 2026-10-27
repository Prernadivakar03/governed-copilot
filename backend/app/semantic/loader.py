# from __future__ import annotations

# from functools import lru_cache
# from pathlib import Path
# from typing import Literal

# import sqlglot
# import yaml
# from pydantic import BaseModel, Field
# from sqlglot import exp

# DEFAULT_PATH = Path(__file__).with_name("semantic.yaml")
# Sensitivity = Literal["public", "internal", "pii"]


# class Column(BaseModel):
#     description: str
#     sensitivity: Sensitivity = "internal"


# class Table(BaseModel):
#     description: str
#     columns: dict[str, Column]


# class Metric(BaseModel):
#     description: str
#     expression: str
#     tables: list[str]
#     filters: list[str] = Field(default_factory=list)
#     grain: str = "overall"
#     owner: str
#     version: int = 1
#     synonyms: list[str] = Field(default_factory=list)


# class Join(BaseModel):
#     left: str
#     right: str
#     cardinality: Literal["one-to-one", "one-to-many", "many-to-one", "many-to-many"]

#     @property
#     def id(self) -> str:
#         return f"join:{self.left}={self.right}"


# class Conflict(BaseModel):
#     metrics: list[str]
#     default: str
#     note: str

# class Semantic(BaseModel):
#     version: int
#     roles: dict[str, list[Sensitivity]]
#     tables: dict[str, Table]
#     metrics: dict[str, Metric]
#     joins: list[Join]
#     rules: list[str] = Field(default_factory=list)
#     conflicts: list[Conflict] = Field(default_factory=list)


# class SemanticError(Exception):
#     pass


# def split_ref(ref: str) -> tuple[str, str]:
#     table, _, col = ref.partition(".")
#     return table, col


# def metric_columns(m: Metric) -> set[tuple[str, str]]:
#     """All (table, column) pairs referenced by a metric's expression and filters."""
#     nodes = [sqlglot.parse_one(m.expression, read="postgres")]
#     nodes += [sqlglot.condition(f, dialect="postgres") for f in m.filters]
#     refs: set[tuple[str, str]] = set()
#     for node in nodes:
#         for col in node.find_all(exp.Column):
#             refs.add((col.table, col.name))
#     return refs


# def check_semantic(sem: Semantic) -> list[str]:
#     problems: list[str] = []

#     for j in sem.joins:
#         for ref in (j.left, j.right):
#             t, c = split_ref(ref)
#             if t not in sem.tables or c not in sem.tables[t].columns:
#                 problems.append(f"join {j.id}: unknown column {ref}")

#     for name, m in sem.metrics.items():
#         for t in m.tables:
#             if t not in sem.tables:
#                 problems.append(f"metric {name}: unknown table {t}")
#         try:
#             refs = metric_columns(m)
#         except sqlglot.errors.SqlglotError as e:
#             problems.append(f"metric {name}: cannot parse ({e})")
#             continue
#         for t, c in refs:
#             if t not in sem.tables or c not in sem.tables[t].columns:
#                 problems.append(f"metric {name}: unknown column {t}.{c}")

#     seen: dict[str, str] = {name.lower(): name for name in sem.metrics}
#     for name, m in sem.metrics.items():
#         for syn in m.synonyms:
#             key = syn.lower()
#             if key in seen and seen[key] != name:
#                 problems.append(f"synonym '{syn}' used by both '{seen[key]}' and '{name}'")
#             seen[key] = name

#     for cf in sem.conflicts:
#         for m in cf.metrics:
#             if m not in sem.metrics:
#                 problems.append(f"conflict: unknown metric {m}")
#         if cf.default not in cf.metrics:
#             problems.append(f"conflict: default {cf.default} is not one of its metrics")
#     return problems


# @lru_cache
# def load_semantic(path: Path = DEFAULT_PATH) -> Semantic:
#     raw = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
#     sem = Semantic.model_validate(raw)
#     problems = check_semantic(sem)
#     if problems:
#         raise SemanticError("Semantic layer invalid:\n  - " + "\n  - ".join(problems))
#     return sem


# def allowed_map(sem: Semantic, role: str) -> dict[str, set[str]]:
#     """{table: {columns}} this role may reference."""
#     if role not in sem.roles:
#         raise ValueError(f"unknown role: {role}")
#     ok = set(sem.roles[role])
#     out: dict[str, set[str]] = {}
#     for t, tbl in sem.tables.items():
#         cols = {c for c, col in tbl.columns.items() if col.sensitivity in ok}
#         if cols:
#             out[t] = cols
#     return out


# def restricted_names(sem: Semantic, role: str) -> frozenset[str]:
#     """Column names that exist in the schema but are not allowed for this role."""
#     allowed = allowed_map(sem, role)
#     names = {c for tbl in sem.tables.values() for c in tbl.columns}
#     permitted = {c for cols in allowed.values() for c in cols}
#     return frozenset(names - permitted)


# if __name__ == "__main__":
#     s = load_semantic()
#     print(f"OK: {len(s.tables)} tables, {len(s.metrics)} metrics, {len(s.joins)} joins")


































from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

import sqlglot
import yaml
from pydantic import BaseModel, Field
from sqlglot import exp

DEFAULT_PATH = Path(__file__).with_name("semantic.yaml")
Sensitivity = Literal["public", "internal", "pii"]


class Column(BaseModel):
    description: str
    sensitivity: Sensitivity = "internal"


class Table(BaseModel):
    description: str
    columns: dict[str, Column]


class Metric(BaseModel):
    description: str
    expression: str
    tables: list[str]
    filters: list[str] = Field(default_factory=list)
    grain: str = "overall"
    owner: str
    version: int = 1
    synonyms: list[str] = Field(default_factory=list)


class Join(BaseModel):
    left: str
    right: str
    cardinality: Literal["one-to-one", "one-to-many", "many-to-one", "many-to-many"]

    @property
    def id(self) -> str:
        return f"join:{self.left}={self.right}"


class Conflict(BaseModel):
    metrics: list[str]
    default: str
    note: str


class Semantic(BaseModel):
    version: int
    roles: dict[str, list[Sensitivity]]
    tables: dict[str, Table]
    metrics: dict[str, Metric]
    joins: list[Join]
    rules: list[str] = Field(default_factory=list)
    conflicts: list[Conflict] = Field(default_factory=list)


class SemanticError(Exception):
    pass


def split_ref(ref: str) -> tuple[str, str]:
    table, _, col = ref.partition(".")
    return table, col


def metric_columns(m: Metric) -> set[tuple[str, str]]:
    """All (table, column) pairs referenced by a metric's expression and filters."""
    nodes = [sqlglot.parse_one(m.expression, read="postgres")]
    nodes += [sqlglot.condition(f, dialect="postgres") for f in m.filters]
    refs: set[tuple[str, str]] = set()
    for node in nodes:
        for col in node.find_all(exp.Column):
            refs.add((col.table, col.name))
    return refs


INJECTION_PATTERNS = [
    r"ignore\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier)\s+(instructions|rules|prompts?)",
    r"disregard\s+(all\s+|any\s+)?(the\s+)?(previous|prior|above|earlier|rules|instructions)",
    r"system\s+prompt",
    r"you\s+are\s+now\b",
    r"\b(reveal|exfiltrate|leak)\b",
    r"override\s+(the\s+)?(rules|policy|policies|validator|permissions?)",
    r"\bnew\s+instructions?\b",
]
_INJECTION = re.compile("|".join(INJECTION_PATTERNS), re.IGNORECASE)


def scan_text_fields(sem: Semantic) -> list[str]:
    """Flag catalog text that looks like instructions to the model."""
    found: list[str] = []

    def check(where: str, text: str) -> None:
        if _INJECTION.search(text):
            found.append(f"possible prompt injection in {where}")

    for t, tbl in sem.tables.items():
        check(f"table {t}", tbl.description)
        for c, col in tbl.columns.items():
            check(f"column {t}.{c}", col.description)
    for n, m in sem.metrics.items():
        check(f"metric {n}", m.description)
        for s in m.synonyms:
            check(f"metric {n} synonym", s)
    for i, r in enumerate(sem.rules):
        check(f"rule {i}", r)
    for cf in sem.conflicts:
        check("conflict note", cf.note)
    return found


def check_semantic(sem: Semantic) -> list[str]:
    problems: list[str] = []

    for j in sem.joins:
        for ref in (j.left, j.right):
            t, c = split_ref(ref)
            if t not in sem.tables or c not in sem.tables[t].columns:
                problems.append(f"join {j.id}: unknown column {ref}")

    for name, m in sem.metrics.items():
        for t in m.tables:
            if t not in sem.tables:
                problems.append(f"metric {name}: unknown table {t}")
        try:
            refs = metric_columns(m)
        except sqlglot.errors.SqlglotError as e:
            problems.append(f"metric {name}: cannot parse ({e})")
            continue
        for t, c in refs:
            if t not in sem.tables or c not in sem.tables[t].columns:
                problems.append(f"metric {name}: unknown column {t}.{c}")

    seen: dict[str, str] = {name.lower(): name for name in sem.metrics}
    for name, m in sem.metrics.items():
        for syn in m.synonyms:
            key = syn.lower()
            if key in seen and seen[key] != name:
                problems.append(f"synonym '{syn}' used by both '{seen[key]}' and '{name}'")
            seen[key] = name

    for cf in sem.conflicts:
        for m in cf.metrics:
            if m not in sem.metrics:
                problems.append(f"conflict: unknown metric {m}")
        if cf.default not in cf.metrics:
            problems.append(f"conflict: default {cf.default} is not one of its metrics")

    problems.extend(scan_text_fields(sem))
    return problems


@lru_cache
def load_semantic(path: Path = DEFAULT_PATH) -> Semantic:
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    sem = Semantic.model_validate(raw)
    problems = check_semantic(sem)
    if problems:
        raise SemanticError("Semantic layer invalid:\n  - " + "\n  - ".join(problems))
    return sem


def allowed_map(sem: Semantic, role: str) -> dict[str, set[str]]:
    """{table: {columns}} this role may reference."""
    if role not in sem.roles:
        raise ValueError(f"unknown role: {role}")
    ok = set(sem.roles[role])
    out: dict[str, set[str]] = {}
    for t, tbl in sem.tables.items():
        cols = {c for c, col in tbl.columns.items() if col.sensitivity in ok}
        if cols:
            out[t] = cols
    return out


def restricted_names(sem: Semantic, role: str) -> frozenset[str]:
    """Column names that exist in the schema but are not allowed for this role."""
    allowed = allowed_map(sem, role)
    names = {c for tbl in sem.tables.values() for c in tbl.columns}
    permitted = {c for cols in allowed.values() for c in cols}
    return frozenset(names - permitted)


def compile_metric_template(metric_name: str, filters: list[str] | None = None) -> str | None:
    """Compile verified SQL for predefined metrics from their formula and join path in semantic.yaml."""
    norm = metric_name.lower().replace("_", " ").strip()
    extra_filters = [f.strip() for f in (filters or []) if f.strip()]

    if norm in ("total revenue", "revenue"):
        where = ["orders.order_status = 'delivered'"] + extra_filters
        return (
            "SELECT SUM(order_items.price) "
            "FROM order_items "
            "JOIN orders ON orders.order_id = order_items.order_id "
            f"WHERE {' AND '.join(where)}"
        )

    if norm in ("average order value", "avg order value", "aov"):
        where = f" WHERE {' AND '.join(extra_filters)}" if extra_filters else ""
        return f"SELECT SUM(order_items.price) / COUNT(DISTINCT order_items.order_id) FROM order_items{where}"

    if norm in ("most used payment type", "most popular payment type"):
        where = f" WHERE {' AND '.join(extra_filters)}" if extra_filters else ""
        return f"SELECT payment_type FROM order_payments{where} GROUP BY payment_type ORDER BY COUNT(*) DESC LIMIT 1"

    if norm in ("canceled orders", "cancelled orders", "canceled order count"):
        where = ["orders.order_status = 'canceled'"] + extra_filters
        return f"SELECT COUNT(*) FROM orders WHERE {' AND '.join(where)}"

    if norm in ("orders with more than one payment", "orders with multiple payments", "multiple payments"):
        where = f" WHERE {' AND '.join(extra_filters)}" if extra_filters else ""
        return f"SELECT COUNT(*) FROM (SELECT order_id FROM order_payments{where} GROUP BY order_id HAVING COUNT(*) > 1) t"

    return None


if __name__ == "__main__":
    s = load_semantic()
    print(f"OK: {len(s.tables)} tables, {len(s.metrics)} metrics, {len(s.joins)} joins")