import pytest

from app.semantic.loader import SemanticError, allowed_map, check_semantic, load_semantic


def test_default_layer_is_valid():
    assert check_semantic(load_semantic()) == []


def test_analyst_has_no_pii_columns():
    cols = allowed_map(load_semantic(), "analyst")["customers"]
    assert "customer_email" not in cols and "customer_phone" not in cols


def test_duplicate_synonym_detected():
    sem = load_semantic().model_copy(deep=True)
    sem.metrics["order_count"].synonyms.append("sales")
    assert any("sales" in p for p in check_semantic(sem))


def test_unknown_column_in_metric_detected():
    sem = load_semantic().model_copy(deep=True)
    sem.metrics["revenue"].expression = "SUM(order_items.nope)"
    assert any("nope" in p for p in check_semantic(sem))


def test_unknown_role():
    with pytest.raises(ValueError):
        allowed_map(load_semantic(), "hacker")