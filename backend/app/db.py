from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.config import settings


def connect() -> psycopg.Connection[dict[str, Any]]:
    """Admin connection for app tables. Rows come back as dicts.
    Use as `with connect() as conn:` (commits on success, rolls back on error)."""
    return psycopg.Connection[dict[str, Any]].connect(settings.admin_conninfo(), row_factory=dict_row)