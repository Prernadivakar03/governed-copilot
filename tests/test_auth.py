import jwt
import pytest

from app.auth.security import create_token, decode_token, hash_password, verify_password


def test_password_roundtrip():
    h = hash_password("S3cret-pass")
    assert h != "S3cret-pass" and verify_password(h, "S3cret-pass")
    assert not verify_password(h, "wrong")


def test_access_token_roundtrip():
    t = create_token(7, "analyst", "access", 5)
    assert decode_token(t, "access")["sub"] == "7"


def test_refresh_token_cannot_be_used_as_access():
    with pytest.raises(jwt.PyJWTError):
        decode_token(create_token(7, "analyst", "refresh", 5), "access")


def test_expired_token_rejected():
    with pytest.raises(jwt.PyJWTError):
        decode_token(create_token(7, "analyst", "access", -1), "access")


def test_tampered_token_rejected():
    t = create_token(7, "analyst", "access", 5)
    with pytest.raises(jwt.PyJWTError):
        decode_token(t[:-3] + ("AAA" if not t.endswith("AAA") else "BBB"), "access")