import uuid
from fastapi.testclient import TestClient
from services.catalog.main import app


def test_health_ok():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["service"] == "catalog"
        assert data["status"] in ("ok", "degraded")
        assert "db" in data


def test_list_products():
    with TestClient(app) as client:
        r = client.get("/products")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


def test_create_product():
    with TestClient(app) as client:
        name = f"Test Product {uuid.uuid4().hex[:6]}"
        r = client.post(
            "/products",
            json={"name": name, "price": 10.5, "in_stock": True},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == name
        assert data["price"] == 10.5
        assert data["in_stock"] is True
        assert "id" in data
