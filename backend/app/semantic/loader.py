from __future__ import annotations

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


class Semantic(BaseModel):
    version: int
    roles: dict[str, list[Sensitivity]]
    tables: dict[str, Table]
    metrics: dict[str, Metric]
    joins: list[Join]
    rules: list[str] = Field(default_factory=list)


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


if __name__ == "__main__":
    s = load_semantic()
    print(f"OK: {len(s.tables)} tables, {len(s.metrics)} metrics, {len(s.joins)} joins")