import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.models import User
from app.auth.security import decode_token
from app.db import connect
from app.governance import audit

bearer = HTTPBearer(auto_error=False)
_UNAUTH = {"WWW-Authenticate": "Bearer"}


def load_user(user_id: int) -> User | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT id, username, role, active FROM app.users WHERE id = %s", (user_id,)
        ).fetchone()
    if row is None or not row["active"]:
        return None
    return User(id=row["id"], username=row["username"], role=row["role"])


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> User:
    if creds is None:
        raise HTTPException(401, "not authenticated", headers=_UNAUTH)
    try:
        user_id = int(decode_token(creds.credentials, "access")["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "invalid or expired token", headers=_UNAUTH)
    user = load_user(user_id)  # role always comes from the DB, never from the token
    if user is None:
        raise HTTPException(401, "user not found or disabled", headers=_UNAUTH)
    return user


def require_roles(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            audit.append("ACCESS_DENIED", user.username, user.role, None,
                         {"required": list(roles)})
            raise HTTPException(403, "your role cannot do this")
        return user

    return dep