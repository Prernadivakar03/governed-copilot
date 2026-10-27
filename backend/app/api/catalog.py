from typing import Any

import psycopg
from psycopg import sql
from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import require_roles
from app.auth.models import User
from app.db import connect
from app.semantic.loader import allowed_map, load_semantic

router = APIRouter(prefix="/catalog", tags=["catalog"])
ALL_ROLES = require_roles("analyst", "steward", "auditor", "admin")


@router.get("/tables")
def list_tables(user: User = Depends(ALL_ROLES)) -> list[dict[str, Any]]:
    """Returns tables and column schemas permitted for the authenticated user's role."""
    sem = load_semantic()
    role_key = "steward" if user.role in ("steward", "admin", "auditor") else "analyst"
    allowed = allowed_map(sem, role_key)

    with connect() as conn, conn.cursor() as cur:
        tables_out = []
        for t_name, tbl in sem.tables.items():
            if t_name not in allowed:
                continue
            # Fetch row count safely
            try:
                cur.execute(sql.SQL("SELECT count(*) FROM analytics.{}").format(sql.Identifier(t_name)))
                res = cur.fetchone()
                row_count = next(iter(res.values())) if res else None
            except (psycopg.Error, OSError):
                row_count = None

            cols = []
            for c_name in sorted(allowed[t_name]):
                col_info = tbl.columns.get(c_name)
                if col_info:
                    cols.append({
                        "name": c_name,
                        "description": col_info.description,
                        "sensitivity": col_info.sensitivity,
                    })

            tables_out.append({
                "name": t_name,
                "description": tbl.description,
                "row_count": row_count,
                "column_count": len(cols),
                "columns": cols,
                "accessible": True,
            })

        return tables_out


@router.get("/tables/{table_name}")
def get_table(table_name: str, user: User = Depends(ALL_ROLES)) -> dict[str, Any]:
    sem = load_semantic()
    role_key = "steward" if user.role in ("steward", "admin", "auditor") else "analyst"
    allowed = allowed_map(sem, role_key)

    if table_name not in allowed:
        raise HTTPException(403, "Access to this table is restricted for your role")

    tbl = sem.tables.get(table_name)
    if not tbl:
        raise HTTPException(404, "Table not found in data catalog")

    with connect() as conn, conn.cursor() as cur:
        try:
            cur.execute(sql.SQL("SELECT count(*) FROM analytics.{}").format(sql.Identifier(table_name)))
            res = cur.fetchone()
            row_count = next(iter(res.values())) if res else None
        except (psycopg.Error, OSError):
            row_count = None

    cols = []
    for c_name in sorted(allowed[table_name]):
        col_info = tbl.columns.get(c_name)
        if col_info:
            cols.append({
                "name": c_name,
                "description": col_info.description,
                "sensitivity": col_info.sensitivity,
            })

    # Relevant joins
    joins = [
        {"left": j.left, "right": j.right, "cardinality": j.cardinality, "id": j.id}
        for j in sem.joins
        if j.left.startswith(f"{table_name}.") or j.right.startswith(f"{table_name}.")
    ]

    return {
        "name": table_name,
        "description": tbl.description,
        "row_count": row_count,
        "columns": cols,
        "joins": joins,
    }
