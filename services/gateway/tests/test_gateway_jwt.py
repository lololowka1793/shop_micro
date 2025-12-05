import jwt
from services.gateway.main import decode_jwt, AUTH_SECRET_KEY, AUTH_ALGORITHM

def test_decode_jwt_user_role_default():
    token = jwt.encode({"sub": "alice"}, AUTH_SECRET_KEY, algorithm=AUTH_ALGORITHM)
    user = decode_jwt(token)
    assert user.username == "alice"
    assert user.role == "user"

def test_decode_jwt_admin_role():
    token = jwt.encode({"sub": "admin", "role": "admin"}, AUTH_SECRET_KEY, algorithm=AUTH_ALGORITHM)
    user = decode_jwt(token)
    assert user.username == "admin"
    assert user.role == "admin"
