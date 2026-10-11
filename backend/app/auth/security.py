from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.config import settings

_ph = PasswordHasher()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def _secret() -> str:
    if len(settings.jwt_secret) < 32:
        raise RuntimeError("JWT_SECRET missing or shorter than 32 characters (check .env)")
    return settings.jwt_secret


def create_token(user_id: int, role: str, kind: str, minutes: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id), "role": role, "typ": kind,
        "iat": now, "exp": now + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, _secret(), algorithm="HS256")


def decode_token(token: str, kind: str) -> dict:
    """Raises jwt.PyJWTError on any problem (bad signature, expired, wrong type)."""
    data = jwt.decode(token, _secret(), algorithms=["HS256"],
                      options={"require": ["exp", "sub", "typ"]})
    if data.get("typ") != kind:
        raise jwt.InvalidTokenError("wrong token type")
    return data