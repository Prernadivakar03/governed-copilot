import time
from typing import Any

import httpx
import psycopg
from fastapi import APIRouter, Depends

from app.auth.deps import require_roles
from app.auth.models import User
from app.config import ROOT, settings
from app.db import connect
from app.semantic.loader import load_semantic

router = APIRouter(prefix="/system", tags=["system"])
ALL_ROLES = require_roles("analyst", "steward", "auditor", "admin")


@router.get("/status")
def system_status(user: User = Depends(ALL_ROLES)) -> dict[str, Any]:
    db_status = "ok"
    db_latency_ms = 0.0
    try:
        t_db = time.perf_counter()
        with connect() as conn:
            conn.execute("SELECT 1")
        db_latency_ms = round((time.perf_counter() - t_db) * 1000, 2)
    except psycopg.Error:
        db_status = "unreachable"

    llm_status = "ok"
    llm_latency_ms = 0.0
    try:
        t_llm = time.perf_counter()
        r = httpx.get(f"{settings.ollama_url}/api/tags", timeout=3)
        r.raise_for_status()
        llm_latency_ms = round((time.perf_counter() - t_llm) * 1000, 2)
    except httpx.HTTPError:
        llm_status = "unreachable"

    # Embedding cache metrics
    emb_cache_dir = ROOT / ".cache" / "emb"
    emb_count = len(list(emb_cache_dir.glob("*.npy"))) if emb_cache_dir.exists() else 0

    # LLM cache metrics
    llm_cache_dir = ROOT / ".cache" / "llm"
    llm_count = len(list(llm_cache_dir.glob("*.json"))) if llm_cache_dir.exists() else 0

    sem = load_semantic()
    total_tables = len(sem.tables)
    total_metrics = len(sem.metrics)

    return {
        "status": "operational" if db_status == "ok" and llm_status == "ok" else "degraded",
        "timestamp": time.time(),
        "database": {
            "status": db_status,
            "host": settings.postgres_host,
            "port": settings.postgres_port,
            "database": settings.postgres_db,
            "ping_latency_ms": db_latency_ms,
            "statement_timeout_ms": settings.statement_timeout_ms,
        },
        "llm": {
            "status": llm_status,
            "provider": "Ollama",
            "url": settings.ollama_url,
            "model": settings.ollama_model,
            "ping_latency_ms": llm_latency_ms,
            "cache_enabled": settings.llm_cache,
            "cached_responses": llm_count,
        },
        "retrieval": {
            "mode": settings.retrieval_mode,
            "cached_vectors": emb_count,
        },
        "semantic_catalog": {
            "registered_tables": total_tables,
            "registered_metrics": total_metrics,
            "rules_count": len(sem.rules),
        },
        "governance": {
            "approval_cost_threshold": settings.approval_cost_threshold,
            "approval_join_threshold": settings.approval_join_threshold,
            "approval_ttl_minutes": settings.approval_ttl_minutes,
        },
    }
