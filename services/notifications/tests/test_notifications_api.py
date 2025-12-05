from fastapi.testclient import TestClient
from services.notifications.main import app

client = TestClient(app)

def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["service"] == "notifications"
    assert data["status"] == "ok"
