import psycopg
import pytest
from app.config import settings
from app.sandbox.executor import execute
from app.semantic.loader import allowed_map, load_semantic, restricted_names
from app.validation.sql_validator import Rejected, validate

SEM = load_semantic()
ALLOWED, RESTRICTED = allowed_map(SEM, "steward"), restricted_names(SEM, "steward")  # most permissive role

DESTRUCTIVE = [
    "DROP TABLE orders", "dRoP tAbLe orders", "DROP SCHEMA analytics CASCADE",
    "DELETE FROM orders", "UPDATE sellers SET seller_state = 'XX'",
    "INSERT INTO sellers (seller_id) VALUES ('x')", "TRUNCATE order_items",
    "ALTER TABLE orders ADD COLUMN x int", "CREATE TABLE t (a int)",
    "GRANT ALL ON orders TO PUBLIC", "COPY orders TO '/tmp/x'", "VACUUM orders", "SET ROLE postgres",
    "EXPLAIN ANALYZE DELETE FROM orders",
    "SELECT 1; DROP TABLE orders", "SELECT order_id FROM orders;\nDELETE FROM orders",
    "WITH d AS (DELETE FROM orders RETURNING order_id) SELECT order_id FROM d",
    "SELECT order_id INTO copy_of_orders FROM orders",
    "SELECT pg_read_file('/etc/passwd')", "SELECT lo_import('/etc/passwd')",
    "SELECT dblink('host=x', 'select 1')", "SELECT set_config('role', 'postgres', false)",
    "SELECT pg_sleep(30)", "SELECT current_setting('server_version')",
    "SELECT usename FROM pg_user", "SELECT * FROM pg_catalog.pg_shadow",
    "SELECT order_id FROM orders -- trailing comment", "SELECT /* x */ order_id FROM orders",
    "SELECT order_id FROM information_schema.tables", "SELECT * FROM orders",
]


@pytest.mark.parametrize("sql", DESTRUCTIVE)
def test_validator_blocks_everything_dangerous(sql):
    with pytest.raises(Rejected):
        validate(sql, ALLOWED, RESTRICTED)


@pytest.fixture(scope="module")
def db_up():
    try:
        psycopg.connect(settings.admin_conninfo(), connect_timeout=3).close()
    except psycopg.OperationalError:
        pytest.skip("database not available")


WRITES = [
    "DELETE FROM orders", "UPDATE sellers SET seller_state = 'XX'",
    "INSERT INTO sellers (seller_id) VALUES ('x')", "TRUNCATE order_items",
    "DROP TABLE orders", "CREATE TABLE analytics.t (a int)",
    "ALTER TABLE orders ADD COLUMN x int", "SELECT 1; DELETE FROM orders",
]


@pytest.mark.parametrize("role", ["analyst", "steward"])
@pytest.mark.parametrize("sql", WRITES)
def test_database_refuses_writes_even_without_the_validator(db_up, role, sql):
    """Last line of defence: skip the validator entirely and the database still says no."""
    with pytest.raises((psycopg.errors.InsufficientPrivilege, psycopg.errors.ReadOnlySqlTransaction)):
        execute(sql, role)


def test_data_is_still_intact(db_up):
    assert execute("SELECT COUNT(*) FROM orders", "steward").rows[0][0] > 0