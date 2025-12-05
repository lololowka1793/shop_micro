from main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_health_ok():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("service") == "users"
