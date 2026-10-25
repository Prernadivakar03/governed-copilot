import pytest
from app.semantic.loader import allowed_map, load_semantic, restricted_names
from app.validation.sql_validator import Rejected, validate

sem = load_semantic()
ANALYST = allowed_map(sem, "analyst")
ANALYST_RESTRICTED = restricted_names(sem, "analyst")
STEWARD = allowed_map(sem, "steward")


def v(sql, allowed=ANALYST, restricted=ANALYST_RESTRICTED):
    return validate(sql, allowed, restricted)


def test_simple_select_gets_limit():
    assert "LIMIT 1000" in v("SELECT COUNT(*) FROM orders")


def test_alias_and_order_by_alias():
    out = v("SELECT order_status, COUNT(*) AS n FROM orders GROUP BY order_status ORDER BY n DESC")
    assert "ORDER BY n DESC" in out


def test_table_alias_resolves():
    v("SELECT c.customer_state FROM customers c")


def test_subquery_ok():
    v("SELECT x FROM (SELECT order_id AS x FROM orders) t")


def test_limit_is_capped():
    out = v("SELECT order_id FROM orders LIMIT 999999")
    assert "LIMIT 1000" in out and "999999" not in out


def test_small_limit_kept():
    assert "LIMIT 5" in v("SELECT order_id FROM orders LIMIT 5")


@pytest.mark.parametrize("sql", [
    "DROP TABLE orders",
    "DELETE FROM orders",
    "UPDATE orders SET order_status = 'x'",
    "INSERT INTO orders (order_id) VALUES ('x')",
    "SELECT 1; DROP TABLE orders",
    "SELECT order_id FROM orders; SELECT 1",
    "SELECT order_id FROM orders -- hi",
    "SELECT /* x */ order_id FROM orders",
    "SELECT pg_sleep(10)",
    "SELECT current_setting('x')",
    "SELECT * FROM pg_catalog.pg_user",
    "SELECT usename FROM pg_user",
    "SELECT order_id INTO newtbl FROM orders",
    "SELECT order_id FROM orders UNION SELECT order_id FROM orders",
    "SELECT * FROM orders",
    "SELECT o.* FROM orders o",
    "",
])
def test_destructive_and_unsafe_blocked(sql):
    with pytest.raises(Rejected):
        v(sql)


@pytest.mark.parametrize("sql", [
    "SELECT customer_email FROM customers",
    "SELECT c.customer_phone FROM customers c",
    "SELECT 1 AS customer_email, customer_email FROM customers",
    "SELECT customer_state FROM customers WHERE customer_email LIKE '%@x.com'",
])
def test_analyst_cannot_touch_pii(sql):
    with pytest.raises(Rejected):
        v(sql)


def test_steward_can_read_pii():
    v("SELECT customer_email FROM customers",
      allowed=STEWARD, restricted=restricted_names(sem, "steward"))