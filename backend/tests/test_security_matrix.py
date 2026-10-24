import psycopg
import pytest

from app.config import settings
from app.semantic.loader import allowed_map, load_semantic, restricted_names
from app.validation.sql_validator import Rejected, validate

SEM = load_semantic()
CASES = [(t, c) for t, tbl in SEM.tables.items() for c in tbl.columns]
ROLES = ["analyst", "steward"]


def permitted(role: str, table: str, column: str) -> bool:
    return column in allowed_map(SEM, role).get(table, set())


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("table,column", CASES)
def test_validator_enforces_policy(role, table, column):
    sql = f"SELECT {column} FROM {table}"
    allowed, restricted = allowed_map(SEM, role), restricted_names(SEM, role)
    if permitted(role, table, column):
        validate(sql, allowed, restricted)
    else:
        with pytest.raises(Rejected):
            validate(sql, allowed, restricted)


@pytest.mark.parametrize("role", ROLES)
@pytest.mark.parametrize("table,column", CASES)
def test_database_grants_enforce_policy(role, table, column):
    try:
        conn = psycopg.connect(settings.role_conninfo(role, 3000))
    except psycopg.OperationalError:
        pytest.skip("database not available")
    sql = f"SELECT {column} FROM {table} LIMIT 1"  # identifiers come from semantic.yaml, not users
    with conn:
        if permitted(role, table, column):
            conn.execute(sql)
        else:
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                conn.execute(sql)