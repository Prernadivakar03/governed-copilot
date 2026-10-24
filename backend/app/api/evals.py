import json
import re

from fastapi import APIRouter, Depends, HTTPException

from app.auth.deps import require_roles
from app.auth.models import User
from app.config import ROOT

router = APIRouter(prefix="/eval", tags=["evaluation"])
READERS = require_roles("auditor", "admin")
RESULTS = ROOT / "eval" / "results"
SAFE_ID = re.compile(r"^[A-Za-z0-9_\-]+$")


@router.get("/runs")
def runs(user: User = Depends(READERS)) -> list[dict]:
    out = []
    for p in sorted(RESULTS.glob("run_*.json"), reverse=True):
        d = json.loads(p.read_text(encoding="utf-8"))
        out.append({"id": p.stem, "meta": d.get("meta", {}), "summary": d.get("summary", {})})
    return out


@router.get("/runs/{run_id}")
def one_run(run_id: str, user: User = Depends(READERS)) -> dict:
    path = RESULTS / f"{run_id}.json"
    if not SAFE_ID.match(run_id) or not path.is_file():  # the id pattern also blocks path traversal
        raise HTTPException(404, "run not found")
    return json.loads(path.read_text(encoding="utf-8"))