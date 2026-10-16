import time
from collections import defaultdict

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.auth.deps import current_user, load_user
from app.auth.models import User
from app.auth.security import create_token, decode_token, hash_password, verify_password
from app.config import settings
from app.db import connect
from app.governance import audit

router = APIRouter(prefix="/auth", tags=["auth"])

_DUMMY_HASH = hash_password("dummy-password-for-constant-time")
_FAILS: dict[str, list[float]] = defaultdict(list)
WINDOW_S, MAX_FAILS = 300, 5
COOKIE = "refresh_token"


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=200)


def _access(user_id: int, role: str) -> str:
    return create_token(user_id, role, "access", settings.jwt_access_minutes)


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response) -> dict:
    key = f"{request.client.host if request.client else '?'}:{body.username.lower()}"
    now = time.time()
    _FAILS[key] = [t for t in _FAILS[key] if now - t < WINDOW_S]
    if len(_FAILS[key]) >= MAX_FAILS:
        audit.append("LOGIN_RATE_LIMITED", body.username, "anonymous")
        raise HTTPException(429, "too many attempts, try again in a few minutes")

    with connect() as conn:
        row = conn.execute(
            "SELECT id, username, password_hash, role, active FROM app.users WHERE username = %s",
            (body.username,)).fetchone()
    # always verify against some hash so unknown users take the same time as wrong passwords
    ok = verify_password(row["password_hash"] if row else _DUMMY_HASH, body.password)
    if not (row and row["active"] and ok):
        _FAILS[key].append(now)
        audit.append("LOGIN_FAILED", body.username, "anonymous")
        raise HTTPException(401, "invalid credentials")

    _FAILS.pop(key, None)
    audit.append("LOGIN_SUCCESS", row["username"], row["role"])
    refresh = create_token(row["id"], row["role"], "refresh", settings.jwt_refresh_days * 1440)
    response.set_cookie(COOKIE, refresh, httponly=True, samesite="lax",
                        secure=settings.cookie_secure,
                        max_age=settings.jwt_refresh_days * 86400, path="/auth")
    return {"access_token": _access(row["id"], row["role"]), "token_type": "bearer",
            "user": {"username": row["username"], "role": row["role"]}}


@router.post("/refresh")
def refresh(request: Request) -> dict:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "no refresh token")
    try:
        user = load_user(int(decode_token(token, "refresh")["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "invalid refresh token")
    if user is None:
        raise HTTPException(401, "user not found or disabled")
    return {"access_token": _access(user.id, user.role), "token_type": "bearer"}


@router.post("/logout")
def logout(response: Response, user: User = Depends(current_user)) -> dict:
    response.delete_cookie(COOKIE, path="/auth")
    audit.append("LOGOUT", user.username, user.role)
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    return {"id": user.id, "username": user.username, "role": user.role}