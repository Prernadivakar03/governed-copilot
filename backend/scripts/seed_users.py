"""Create demo users. All share SEED_USER_PASSWORD from .env (dev only)."""
from app.auth.security import hash_password
from app.config import settings
from app.db import connect
from app.governance import audit

USERS = [
    ("alice", "analyst"), ("bob", "analyst"),
    ("sam", "steward"), ("sara", "steward"),
    ("adam", "admin"), ("audrey", "auditor"),
]


def main() -> None:
    if len(settings.seed_user_password) < 8:
        raise SystemExit("Set SEED_USER_PASSWORD (8+ characters) in .env")
    with connect() as conn:
        for username, role in USERS:
            conn.execute(
                """INSERT INTO app.users (username, password_hash, role) VALUES (%s, %s, %s)
                   ON CONFLICT (username) DO UPDATE
                   SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, active = TRUE""",
                (username, hash_password(settings.seed_user_password), role),
            )
            audit.append("USER_SEEDED", "system", "system", None,
                         {"username": username, "role": role}, conn=conn)
    print("seeded:", ", ".join(u for u, _ in USERS))


if __name__ == "__main__":
    main()