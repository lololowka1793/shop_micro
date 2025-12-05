from fastapi.testclient import TestClient
from services.orders.main import app


def test_health_ok():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["service"] == "orders"
        assert data["status"] in ("ok", "degraded")
        assert "db" in data


def test_list_orders():
    with TestClient(app) as client:
        r = client.get("/orders")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
