from fastapi.testclient import TestClient
from services.auth.main import app

client = TestClient(app)

def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["service"] == "auth"
    assert data["status"] == "ok"
