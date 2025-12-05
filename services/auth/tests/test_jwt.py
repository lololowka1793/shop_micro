import jwt
from services.auth.main import create_access_token, AUTH_SECRET_KEY, AUTH_ALGORITHM

def test_create_access_token_contains_role_and_sub():
    token = create_access_token({"sub": "alice", "role": "user"})
    payload = jwt.decode(token, AUTH_SECRET_KEY, algorithms=[AUTH_ALGORITHM])

    assert payload["sub"] == "alice"
    assert payload["role"] == "user"
    assert "exp" in payload
