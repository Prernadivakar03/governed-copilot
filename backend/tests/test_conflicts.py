from app.retrieval.retriever import Retriever
from app.semantic.loader import load_semantic


def ctx(q: str):
    return Retriever(load_semantic(), "analyst", mode="bm25").context(q)


def test_default_metric_for_plain_revenue():
    c = ctx("what is total revenue")
    assert "revenue" in c.metrics and "gross_revenue_with_freight" not in c.metrics
    assert c.notes and "documented default" in c.notes[0]


def test_gross_metric_when_asked():
    c = ctx("what is gross revenue including freight")
    assert "gross_revenue_with_freight" in c.metrics and "revenue" not in c.metrics