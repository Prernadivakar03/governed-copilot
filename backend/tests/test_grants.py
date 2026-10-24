import psycopg
import pytest

from app.config import settings


def _connect(role: str):
    try:
        return psycopg.connect(settings.role_conninfo(role, 3000))
    except psycopg.OperationalError:
        pytest.skip("database not available")


def test_analyst_cannot_read_email():
    with _connect("analyst") as conn:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("SELECT customer_email FROM customers LIMIT 1")


def test_steward_can_read_email():
    with _connect("steward") as conn:
        assert conn.execute("SELECT customer_email FROM customers LIMIT 1").fetchone()


def test_roles_cannot_write():
    with _connect("steward") as conn:
        with pytest.raises(psycopg.errors.Error):
            conn.execute("DELETE FROM orders")


def test_app_schema_hidden_from_analyst():
    with _connect("analyst") as conn:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            conn.execute("SELECT * FROM app.users")