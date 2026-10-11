"""Create the `app` schema. Safe to run repeatedly."""
from app.db import connect

STATEMENTS = [
    "CREATE SCHEMA IF NOT EXISTS app",
    """CREATE TABLE IF NOT EXISTS app.users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('analyst','steward','auditor','admin')),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""",
    """CREATE TABLE IF NOT EXISTS app.queries (
        id TEXT PRIMARY KEY,
        user_id INT NOT NULL REFERENCES app.users(id),
        question TEXT NOT NULL,
        data_role TEXT NOT NULL,
        status TEXT NOT NULL,
        sql TEXT,
        message TEXT,
        result_json TEXT,
        latency_ms INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_queries_user ON app.queries(user_id, created_at DESC)",
    """CREATE TABLE IF NOT EXISTS app.approvals (
        id SERIAL PRIMARY KEY,
        query_id TEXT UNIQUE NOT NULL REFERENCES app.queries(id),
        requested_by INT NOT NULL REFERENCES app.users(id),
        gate_reason TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
        decided_by INT REFERENCES app.users(id),
        decision_reason TEXT,
        decided_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS app.audit_log (
        id BIGSERIAL PRIMARY KEY,
        ts TEXT NOT NULL,
        actor TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        event TEXT NOT NULL,
        query_id TEXT,
        payload TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL
    )""",
    """CREATE OR REPLACE FUNCTION app.audit_block_mutation() RETURNS trigger AS $$
    BEGIN
        RAISE EXCEPTION 'audit_log is append-only';
    END;
    $$ LANGUAGE plpgsql""",
    "DROP TRIGGER IF EXISTS audit_no_update ON app.audit_log",
    """CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON app.audit_log
       FOR EACH ROW EXECUTE FUNCTION app.audit_block_mutation()""",
    "DROP TRIGGER IF EXISTS audit_no_truncate ON app.audit_log",
    """CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON app.audit_log
       FOR EACH STATEMENT EXECUTE FUNCTION app.audit_block_mutation()""",
]


def main() -> None:
    with connect() as conn:
        for stmt in STATEMENTS:
            conn.execute(stmt)
    print("app schema ready")


if __name__ == "__main__":
    main()