import jwt
from main import create_access_token, AUTH_SECRET_KEY, AUTH_ALGORITHM

def test_create_access_token_contains_sub_and_role():
    token = create_access_token({"sub": "alice", "role": "user"})
    payload = jwt.decode(token, AUTH_SECRET_KEY, algorithms=[AUTH_ALGORITHM])

    assert payload["sub"] == "alice"
    assert payload["role"] == "user"
    assert "exp" in payload
