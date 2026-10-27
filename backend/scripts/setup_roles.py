"""Create read-only login roles and apply table/column grants.

analyst_ro : everything except customers.customer_email / customer_phone
steward_ro : everything
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import psycopg
from app.config import settings
from psycopg import sql

ROLES = {
    "analyst_ro": settings.analyst_ro_password,
    "steward_ro": settings.steward_ro_password,
}
ANALYST_CUSTOMER_COLUMNS = [
    "customer_id", "customer_unique_id", "customer_zip_code_prefix",
    "customer_city", "customer_state",
]


def main() -> None:
    with psycopg.connect(settings.admin_conninfo(), autocommit=True) as conn:
        for role, pw in ROLES.items():
            if not pw:
                raise SystemExit(f"Set a password for {role} in .env")
            exists = conn.execute(
                "SELECT 1 FROM pg_roles WHERE rolname = %s", (role,)
            ).fetchone()
            verb = "ALTER" if exists else "CREATE"
            conn.execute(
                sql.SQL("{} ROLE {} LOGIN PASSWORD {}").format(
                    sql.SQL(verb), sql.Identifier(role), sql.Literal(pw)
                )
            )
            r = sql.Identifier(role)
            conn.execute(sql.SQL("ALTER ROLE {} SET search_path = analytics").format(r))
            conn.execute(sql.SQL("ALTER ROLE {} SET default_transaction_read_only = on").format(r))
            conn.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}").format(
                sql.Identifier(settings.postgres_db), r))
            conn.execute(sql.SQL("GRANT USAGE ON SCHEMA analytics TO {}").format(r))
            conn.execute(sql.SQL("REVOKE ALL ON ALL TABLES IN SCHEMA analytics FROM {}").format(r))

        tables = [row[0] for row in conn.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'analytics' AND table_type = 'BASE TABLE'"
        ).fetchall()]

        for t in tables:
            tbl = sql.SQL("analytics.{}").format(sql.Identifier(t))
            conn.execute(sql.SQL("GRANT SELECT ON {} TO steward_ro").format(tbl))
            if t == "customers":
                cols = sql.SQL(", ").join(sql.Identifier(c) for c in ANALYST_CUSTOMER_COLUMNS)
                conn.execute(sql.SQL("GRANT SELECT ({}) ON {} TO analyst_ro").format(cols, tbl))
            else:
                conn.execute(sql.SQL("GRANT SELECT ON {} TO analyst_ro").format(tbl))
    print("roles and grants applied")


if __name__ == "__main__":
    main()