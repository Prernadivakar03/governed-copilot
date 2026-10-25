from app.config import settings
from app.governance.policy import sensitive_columns_in, static_reasons


def test_sensitive_columns_detected():
    assert sensitive_columns_in("SELECT customer_email FROM customers") == ["customer_email"]


def test_clean_query_has_no_reasons():
    assert static_reasons("SELECT COUNT(*) FROM orders") == []


def test_pii_query_flagged():
    assert any("sensitive" in r for r in static_reasons("SELECT customer_phone FROM customers"))


def test_many_joins_flagged(monkeypatch):
    monkeypatch.setattr(settings, "approval_join_threshold", 4)
    sql = ("SELECT 1 AS x FROM orders o "
           "JOIN order_items i ON i.order_id = o.order_id "
           "JOIN products p ON p.product_id = i.product_id "
           "JOIN sellers s ON s.seller_id = i.seller_id "
           "JOIN customers c ON c.customer_id = o.customer_id")
    assert any("joins" in r for r in static_reasons(sql))