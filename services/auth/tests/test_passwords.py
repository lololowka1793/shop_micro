from services.auth.main import get_password_hash, verify_password

def test_hash_and_verify_password():
    password = "pass123"
    hashed = get_password_hash(password)

    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong", hashed) is False
