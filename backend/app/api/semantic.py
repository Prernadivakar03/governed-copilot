from typing import Any

from fastapi import APIRouter, Depends

from app.auth.deps import require_roles
from app.auth.models import User
from app.semantic.loader import allowed_map, load_semantic, metric_columns

router = APIRouter(prefix="/semantic", tags=["semantic"])
ALL_ROLES = require_roles("analyst", "steward", "auditor", "admin")


@router.get("")
def get_semantic_model(user: User = Depends(ALL_ROLES)) -> dict[str, Any]:
    """Returns the full semantic layer definitions filtered by user access role."""
    sem = load_semantic()
    role_key = "steward" if user.role in ("steward", "admin", "auditor") else "analyst"
    allowed = allowed_map(sem, role_key)

    # Filter metrics: all required columns must be accessible
    metrics_out = {}
    for name, m in sem.metrics.items():
        can_access = all(col in allowed.get(tbl, set()) for tbl, col in metric_columns(m))
        if can_access:
            metrics_out[name] = {
                "name": name,
                "description": m.description,
                "expression": m.expression,
                "tables": m.tables,
                "filters": m.filters,
                "owner": m.owner,
                "version": m.version,
                "synonyms": m.synonyms,
            }

    # Filter joins
    joins_out = []
    for j in sem.joins:
        lt, lc = j.left.split(".", 1)
        rt, rc = j.right.split(".", 1)
        if lc in allowed.get(lt, set()) and rc in allowed.get(rt, set()):
            joins_out.append({
                "id": j.id,
                "left": j.left,
                "right": j.right,
                "cardinality": j.cardinality,
            })

    # Conflicts
    conflicts_out = [
        {"metrics": cf.metrics, "default": cf.default, "note": cf.note}
        for cf in sem.conflicts
    ]

    return {
        "version": sem.version,
        "metrics": metrics_out,
        "joins": joins_out,
        "rules": sem.rules,
        "conflicts": conflicts_out,
        "role": user.role,
        "data_role": role_key,
    }
