import psycopg
import pytest
from app.config import settings
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    c = TestClient(app)
    try:
        r = c.post("/auth/login", json={"username": "alice", "password": settings.seed_user_password})
    except psycopg.Error:
        pytest.skip("database not available")
    if r.status_code != 200:
        pytest.skip("run: python -m scripts.seed_users")
    return c


def auth(client, username: str) -> dict:
    r = client.post("/auth/login", json={"username": username, "password": settings.seed_user_password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_no_token_is_401(client):
    assert client.get("/queries").status_code == 401


def test_wrong_password_is_401(client):
    r = client.post("/auth/login", json={"username": "alice", "password": "nope-nope"})
    assert r.status_code == 401


def test_refresh_cookie_is_httponly(client):
    r = client.post("/auth/login", json={"username": "alice", "password": settings.seed_user_password})
    assert "httponly" in r.headers["set-cookie"].lower()


def test_garbage_token_is_401(client):
    assert client.get("/auth/me", headers={"Authorization": "Bearer abc.def.ghi"}).status_code == 401


def test_analyst_cannot_list_approvals(client):
    assert client.get("/approvals", headers=auth(client, "alice")).status_code == 403


def test_analyst_cannot_read_audit(client):
    assert client.get("/audit/events", headers=auth(client, "alice")).status_code == 403


def test_auditor_cannot_ask_questions(client):
    r = client.post("/queries", json={"question": "How many sellers are there?"},
                    headers=auth(client, "audrey"))
    assert r.status_code == 403


def test_auditor_can_verify_chain(client):
    r = client.get("/audit/verify", headers=auth(client, "audrey"))
    assert r.status_code == 200 and r.json()["ok"] is True