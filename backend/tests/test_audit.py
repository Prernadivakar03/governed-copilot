import psycopg
import pytest
from app.db import connect
from app.governance import audit


@pytest.fixture
def conn():
    try:
        c = connect()
    except psycopg.OperationalError:
        pytest.skip("database not available")
    yield c
    c.rollback()
    c.close()


def test_chain_verifies_and_masks_pii(conn):
    audit.append("T1", "tester", "analyst", None, {"a": 1}, conn=conn)
    audit.append("T2", "tester", "analyst", None, {"note": "mail bob@example.com"}, conn=conn)
    assert audit.verify_chain(conn)["ok"]
    last = conn.execute("SELECT payload FROM app.audit_log ORDER BY id DESC LIMIT 1").fetchone()
    assert "bob@example.com" not in last["payload"]


def test_update_blocked_by_trigger(conn):
    audit.append("T1", "tester", "analyst", None, {}, conn=conn)
    with pytest.raises(psycopg.errors.RaiseException):
        conn.execute("UPDATE app.audit_log SET actor = 'mallory'")


def test_delete_blocked_by_trigger(conn):
    audit.append("T1", "tester", "analyst", None, {}, conn=conn)
    with pytest.raises(psycopg.errors.RaiseException):
        conn.execute("DELETE FROM app.audit_log")


def test_tampering_is_detected_even_by_a_privileged_user(conn):
    audit.append("T1", "tester", "analyst", None, {"a": 1}, conn=conn)
    audit.append("T2", "tester", "analyst", None, {"a": 2}, conn=conn)
    victim = conn.execute("SELECT id FROM app.audit_log ORDER BY id DESC LIMIT 1").fetchone()["id"]
    conn.execute("ALTER TABLE app.audit_log DISABLE TRIGGER audit_no_update")  # owner bypass
    conn.execute("UPDATE app.audit_log SET actor = 'mallory' WHERE id = %s", (victim,))
    result = audit.verify_chain(conn)
    assert not result["ok"] and result["broken_at"] == victim