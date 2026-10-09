from __future__ import annotations

import re
from dataclasses import dataclass, field

import networkx as nx
from rank_bm25 import BM25Okapi

from app.semantic.loader import (
    Join, Metric, Semantic, allowed_map, metric_columns, split_ref,
)


def tokenize(text: str) -> list[str]:
    toks = re.findall(r"[a-z0-9]+", text.lower())
    return [t[:-1] if len(t) > 3 and t.endswith("s") else t for t in toks]


@dataclass
class Doc:
    id: str
    kind: str
    text: str
    tables: tuple[str, ...]


@dataclass
class Context:
    tables: dict[str, dict[str, str]]  # table -> {column: description}
    table_desc: dict[str, str]
    joins: list[Join]
    metrics: dict[str, Metric]
    rules: list[str]
    source_ids: set[str] = field(default_factory=set)


class Retriever:
    """Permission-filtered retrieval. Hidden columns never reach the LLM."""

    def __init__(self, sem: Semantic, role: str):
        self.sem = sem
        self.role = role
        self.allowed = allowed_map(sem, role)
        self.joins = [
            j for j in sem.joins
            if split_ref(j.left)[1] in self.allowed.get(split_ref(j.left)[0], set())
            and split_ref(j.right)[1] in self.allowed.get(split_ref(j.right)[0], set())
        ]
        self.metrics = {
            n: m for n, m in sem.metrics.items()
            if all(c in self.allowed.get(t, set()) for t, c in metric_columns(m))
        }
        self.graph = nx.Graph()
        for j in self.joins:
            self.graph.add_edge(split_ref(j.left)[0], split_ref(j.right)[0])
        self.docs = self._build_docs()
        self.bm25 = BM25Okapi([tokenize(d.text) for d in self.docs])

    def _build_docs(self) -> list[Doc]:
        docs: list[Doc] = []
        for t, cols in self.allowed.items():
            tbl = self.sem.tables[t]
            docs.append(Doc(f"table:{t}", "table",
                            f"{t} {tbl.description} columns {' '.join(sorted(cols))}", (t,)))
            for c in sorted(cols):
                docs.append(Doc(f"col:{t}.{c}", "column",
                                f"{t} {c} {tbl.columns[c].description}", (t,)))
        for n, m in self.metrics.items():
            docs.append(Doc(f"metric:{n}", "metric",
                            f"{n} {m.description} {' '.join(m.synonyms)}", tuple(m.tables)))
        for j in self.joins:
            lt, rt = split_ref(j.left)[0], split_ref(j.right)[0]
            docs.append(Doc(j.id, "join", f"join {lt} {rt}", (lt, rt)))
        return docs

    def search(self, question: str, k: int = 12) -> list[Doc]:
        scores = self.bm25.get_scores(tokenize(question))
        ranked = sorted(zip(scores, self.docs), key=lambda p: p[0], reverse=True)
        return [d for s, d in ranked[:k] if s > 0]

    def context(self, question: str, k: int = 12) -> Context:
        hits = self.search(question, k)
        tables: set[str] = set()
        hit_metrics: set[str] = set()
        for d in hits:
            tables.update(t for t in d.tables if t in self.allowed)
            if d.kind == "metric":
                hit_metrics.add(d.id.split(":", 1)[1])
        if not tables:
            tables = set(self.allowed)

        # join-graph reasoning: add bridging tables so joins can be expressed
        sel = sorted(tables)
        for i, a in enumerate(sel):
            for b in sel[i + 1:]:
                if a in self.graph and b in self.graph and nx.has_path(self.graph, a, b):
                    tables.update(nx.shortest_path(self.graph, a, b))

        ctx_tables = {
            t: {c: self.sem.tables[t].columns[c].description for c in sorted(self.allowed[t])}
            for t in sorted(tables)
        }
        joins = [j for j in self.joins
                 if split_ref(j.left)[0] in tables and split_ref(j.right)[0] in tables]
        metrics = {n: self.metrics[n] for n in hit_metrics}

        ids = {f"table:{t}" for t in ctx_tables}
        ids |= {f"col:{t}.{c}" for t, cols in ctx_tables.items() for c in cols}
        ids |= {j.id for j in joins} | {f"metric:{n}" for n in metrics}
        return Context(
            tables=ctx_tables,
            table_desc={t: self.sem.tables[t].description for t in ctx_tables},
            joins=joins, metrics=metrics, rules=self.sem.rules, source_ids=ids,
        )