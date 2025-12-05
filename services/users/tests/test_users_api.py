import uuid
from fastapi.testclient import TestClient
from services.users.main import app


def test_health_ok():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["service"] == "users"
        assert data["status"] in ("ok", "degraded")
        assert "db" in data


def test_list_users():
    with TestClient(app) as client:
        r = client.get("/users")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


def test_create_user():
    with TestClient(app) as client:
        username = f"test_{uuid.uuid4().hex[:8]}"
        r = client.post(
            "/users",
            json={"username": username, "email": f"{username}@example.com"},
        )
        assert r.status_code == 201
        data = r.json()
        assert data["username"] == username
        assert data["email"] == f"{username}@example.com"
        assert "id" in data
