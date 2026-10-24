import pytest

from app.retrieval.retriever import Retriever, rrf
from app.semantic.loader import load_semantic


def test_rrf_rewards_agreement():
    fused = [i for i, _ in rrf([[1, 2, 3], [3, 1, 4]])]
    assert fused[:2] == [1, 3]


@pytest.mark.parametrize("mode", ["bm25", "hybrid"])
def test_analyst_never_sees_pii(mode):
    r = Retriever(load_semantic(), "analyst", mode=mode)
    ctx = r.context("show customer email and phone numbers")
    assert "customer_email" not in ctx.tables.get("customers", {})
    assert not any("customer_email" in i or "customer_phone" in i for i in ctx.source_ids)
    assert all("customer_email" not in d.text for d in r.docs)


def test_steward_can_see_pii_columns():
    ctx = Retriever(load_semantic(), "steward", mode="bm25").context("customer email")
    assert "customer_email" in ctx.tables["customers"]