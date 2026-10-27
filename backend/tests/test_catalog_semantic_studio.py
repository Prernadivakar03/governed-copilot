import pytest
from app.config import settings
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def auth(client, username: str) -> dict:
    r = client.post("/auth/login", json={"username": username, "password": settings.seed_user_password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_catalog_tables(client):
    headers = auth(client, "alice")
    r = client.get("/catalog/tables", headers=headers)
    assert r.status_code == 200
    tables = r.json()
    assert isinstance(tables, list)
    names = [t["name"] for t in tables]
    assert "orders" in names
    assert "customers" in names
    # Verify analyst cannot see PII columns in catalog
    cust_table = next(t for t in tables if t["name"] == "customers")
    col_names = [c["name"] for c in cust_table["columns"]]
    assert "customer_city" in col_names
    assert "customer_email" not in col_names


def test_catalog_steward_sees_pii(client):
    headers = auth(client, "sam")
    r = client.get("/catalog/tables", headers=headers)
    assert r.status_code == 200
    tables = r.json()
    cust_table = next(t for t in tables if t["name"] == "customers")
    col_names = [c["name"] for c in cust_table["columns"]]
    assert "customer_email" in col_names


def test_semantic_model(client):
    headers = auth(client, "alice")
    r = client.get("/semantic", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "metrics" in data
    assert "revenue" in data["metrics"]
    assert "joins" in data
    assert "rules" in data
    assert len(data["rules"]) > 0


def test_studio_validation_pass(client):
    headers = auth(client, "alice")
    r = client.post("/studio/validate", json={"sql": "SELECT order_status, count(*) FROM orders GROUP BY order_status"}, headers=headers)
    assert r.status_code == 200
    res = r.json()
    assert res["valid"] is True
    assert "LIMIT" in res["safe_sql"]


def test_studio_validation_reject_pii_analyst(client):
    headers = auth(client, "alice")
    r = client.post("/studio/validate", json={"sql": "SELECT customer_email FROM customers"}, headers=headers)
    assert r.status_code == 200
    res = r.json()
    assert res["valid"] is False
    assert "customer_email" in res["error"]


def test_studio_validation_reject_destructive(client):
    headers = auth(client, "alice")
    r = client.post("/studio/validate", json={"sql": "DROP TABLE orders"}, headers=headers)
    assert r.status_code == 200
    res = r.json()
    assert res["valid"] is False


def test_system_status(client):
    headers = auth(client, "adam")
    r = client.get("/system/status", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert "database" in data
    assert "llm" in data
    assert "semantic_catalog" in data
