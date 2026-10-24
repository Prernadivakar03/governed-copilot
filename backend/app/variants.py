"""System variants for baselines and ablations. The production path uses VARIANTS['full']."""
from __future__ import annotations

from dataclasses import dataclass, replace

from app.retrieval.retriever import Context
from app.semantic.loader import Semantic


@dataclass(frozen=True)
class Variant:
    name: str
    retrieval: str = "hybrid"   # bm25 | vector | hybrid | full_schema
    semantic: bool = True       # metrics, rules, conflict notes and join hints in the prompt
    validate: bool = True       # sqlglot validator
    permissions: bool = True    # False: the pre-LLM filter is off (prompt may show PII columns)


VARIANTS: dict[str, Variant] = {
    "b0": Variant("b0", retrieval="full_schema", semantic=False, validate=False, permissions=False),
    "b1": Variant("b1", retrieval="vector", semantic=False),
    "full": Variant("full"),
    "no_semantic": Variant("no_semantic", semantic=False),
    "no_hybrid": Variant("no_hybrid", retrieval="bm25"),
    "no_validation": Variant("no_validation", validate=False),
    "no_permissions": Variant("no_permissions", permissions=False),
}


def full_schema_context(sem: Semantic) -> Context:
    """Baseline B0: every table and column, no joins, no metrics, no rules."""
    tables = {t: {c: col.description for c, col in tbl.columns.items()}
              for t, tbl in sem.tables.items()}
    ids = {f"table:{t}" for t in tables}
    ids |= {f"col:{t}.{c}" for t, cols in tables.items() for c in cols}
    return Context(
        tables=tables,
        table_desc={t: tbl.description for t, tbl in sem.tables.items()},
        joins=[], metrics={}, rules=[], source_ids=ids, mode="full_schema",
    )


def strip_semantic(ctx: Context) -> Context:
    ids = {i for i in ctx.source_ids if not i.startswith(("metric:", "join:"))}
    return replace(ctx, joins=[], metrics={}, rules=[], notes=[], source_ids=ids)