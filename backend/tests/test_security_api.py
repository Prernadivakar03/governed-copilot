import uuid
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.auth.security import create_token
from app.config import settings
from app.db import connect
from app.main import app
from app.pipeline import QueryResult, _cite
from app.retrieval.retriever import Retriever
from app.semantic.loader import load_semantic


@pytest.fixture(scope="module")
def client():
    c = TestClient(app)
    try:
        r = c.post("/auth/login", json={"username": "alice", "password": settings.seed_user_password})
    except Exception:
        pytest.skip("database not available")
    if r.status_code != 200:
        pytest.skip("run: python -m scripts.seed_users")
    return c


def who(client, name: str):
    r = client.post("/auth/login", json={"username": name, "password": settings.seed_user_password})
    assert r.status_code == 200
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    return headers, client.get("/auth/me", headers=headers).json()["id"]


def test_forged_role_claim_is_ignored(client):
    _, uid = who(client, "alice")
    forged = create_token(uid, "admin", "access", 5)  # validly signed, but claims admin
    r = client.get("/audit/events", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 403  # the server uses the role stored in the database


def test_refresh_token_is_not_an_access_token(client):
    _, uid = who(client, "alice")
    token = create_token(uid, "analyst", "refresh", 5)
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_user_cannot_read_someone_elses_query(client):
    alice, alice_id = who(client, "alice")
    bob, _ = who(client, "bob")
    qid = uuid.uuid4().hex
    with connect() as conn:
        conn.execute("INSERT INTO app.queries (id, user_id, question, data_role, status) "
                     "VALUES (%s, %s, 'private question', 'analyst', 'COMPLETED')", (qid, alice_id))
    try:
        assert client.get(f"/queries/{qid}", headers=bob).status_code == 404
        assert client.get(f"/queries/{qid}/events", headers=bob).status_code == 404
        assert client.get(f"/queries/{qid}", headers=alice).status_code == 200
    finally:
        with connect() as conn:
            conn.execute("DELETE FROM app.queries WHERE id = %s", (qid,))


def test_approval_endpoints_are_locked_down(client):
    assert client.post("/approvals/1/approve", json={"reason": "no credentials"}).status_code == 401
    alice, _ = who(client, "alice")
    assert client.post("/approvals/1/approve", json={"reason": "analysts cannot"}, headers=alice).status_code == 403
    sam, _ = who(client, "sam")
    assert client.post("/approvals/99999999/approve", json={"reason": "no such item"}, headers=sam).status_code == 404
    assert client.post("/approvals/1/approve", json={"reason": "no"}, headers=sam).status_code == 422


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
def test_audit_log_has_no_write_endpoints(client, method):
    audrey, _ = who(client, "audrey")
    for path in ("/audit/events", "/audit/events/1", "/audit/verify"):
        assert getattr(client, method)(path, headers=audrey).status_code == 405


def test_login_sql_injection_attempt_fails(client):
    r = client.post("/auth/login", json={"username": "alice' OR '1'='1", "password": "x' OR '1'='1"})
    assert r.status_code == 401


def test_login_is_rate_limited(client):
    probe = f"probe_{uuid.uuid4().hex[:8]}"
    codes = [client.post("/auth/login", json={"username": probe, "password": "wrong-password"}).status_code
             for _ in range(7)]
    assert codes[:5] == [401] * 5 and 429 in codes[5:]


def test_invented_citations_are_separated_from_real_ones():
    res = QueryResult()
    ctx = SimpleNamespace(source_ids={"table:orders", "col:orders.order_id"})
    _cite(res, {"source_ids": ["table:orders", "table:made_up", 7, "metric:fake"]}, ctx)
    assert res.source_ids == ["table:orders"]
    assert res.invalid_citations == ["table:made_up", "metric:fake"]
    _cite(res, {"source_ids": "table:orders"}, ctx)  # wrong shape is ignored, not trusted
    assert res.source_ids == []


def test_removed_metadata_cannot_be_cited():
    sem = load_semantic().model_copy(deep=True)
    del sem.tables["orders"].columns["order_status"]
    ctx = Retriever(sem, "analyst", mode="bm25").context("orders by status")
    assert "col:orders.order_status" not in ctx.source_ids