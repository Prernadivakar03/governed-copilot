import psycopg
from psycopg.rows import dict_row

from app.config import settings


def connect() -> psycopg.Connection:
    """Admin connection for app tables. Rows come back as dicts.
    Use as `with connect() as conn:` (commits on success, rolls back on error)."""
    return psycopg.connect(settings.admin_conninfo(), row_factory=dict_row)