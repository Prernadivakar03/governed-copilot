import uuid

import psycopg
import pytest

from app.auth.models import User
from app.db import connect
from app.governance import approvals


@pytest.fixture
def conn():
    try:
        c = connect()
    except psycopg.OperationalError:
        pytest.skip("database not available")
    yield c
    c.rollback()
    c.close()


def user(conn, name: str) -> User:
    row = conn.execute("SELECT id, username, role FROM app.users WHERE username = %s",
                       (name,)).fetchone()
    if row is None:
        pytest.skip("run: python -m scripts.seed_users")
    return User(**row)


def pending(conn, requester: User, ttl: int = 60) -> int:
    qid = uuid.uuid4().hex
    conn.execute("INSERT INTO app.queries (id, user_id, question, data_role, status, sql) "
                 "VALUES (%s, %s, 'q', 'analyst', 'PENDING_APPROVAL', 'SELECT 1')",
                 (qid, requester.id))
    return approvals.create_pending(conn, qid, requester.id, "test", ttl)


def test_steward_approves_analyst_query(conn):
    aid = pending(conn, user(conn, "alice"))
    out = approvals.decide(conn, aid, user(conn, "sam"), "APPROVED", "looks fine to me")
    assert out["outcome"] == "decided"


def test_self_approval_blocked(conn):
    sam = user(conn, "sam")
    with pytest.raises(approvals.SelfApproval):
        approvals.decide(conn, pending(conn, sam), sam, "APPROVED", "approving myself")


def test_analyst_cannot_approve(conn):
    aid = pending(conn, user(conn, "bob"))
    with pytest.raises(approvals.Forbidden):
        approvals.decide(conn, aid, user(conn, "alice"), "APPROVED", "let me do it")


def test_reason_is_mandatory(conn):
    aid = pending(conn, user(conn, "alice"))
    with pytest.raises(approvals.ReasonRequired):
        approvals.decide(conn, aid, user(conn, "sam"), "APPROVED", "  ")


def test_duplicate_approval_is_idempotent(conn):
    aid, sam = pending(conn, user(conn, "alice")), user(conn, "sam")
    approvals.decide(conn, aid, sam, "APPROVED", "first decision")
    again = approvals.decide(conn, aid, sam, "APPROVED", "first decision")
    assert again["outcome"] == "unchanged"


def test_conflicting_second_decision_refused(conn):
    aid = pending(conn, user(conn, "alice"))
    approvals.decide(conn, aid, user(conn, "sam"), "APPROVED", "approved by sam")
    with pytest.raises(approvals.AlreadyDecided):
        approvals.decide(conn, aid, user(conn, "sara"), "REJECTED", "rejected by sara")


def test_expired_approval_cannot_be_approved(conn):
    aid = pending(conn, user(conn, "alice"), ttl=-1)
    out = approvals.decide(conn, aid, user(conn, "sam"), "APPROVED", "too late though")
    assert out["outcome"] == "expired"


def test_unknown_approval(conn):
    with pytest.raises(approvals.NotFound):
        approvals.decide(conn, 99999999, user(conn, "sam"), "APPROVED", "does not exist")