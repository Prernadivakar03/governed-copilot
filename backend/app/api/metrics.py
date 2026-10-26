from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from app.auth.deps import require_roles
from app.auth.models import User
from app.db import connect

router = APIRouter(tags=["metrics"])
READERS = require_roles("auditor", "admin")


def collect() -> dict:
    with connect() as conn:
        by_status = {r["status"]: r["n"] for r in conn.execute(
            "SELECT status, count(*) AS n FROM app.queries GROUP BY status").fetchall()}
        lat = conn.execute(
            "SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50, "
            "percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95 "
            "FROM app.queries WHERE latency_ms IS NOT NULL").fetchone()
        flags = conn.execute(
            "SELECT count(*) AS n FROM app.audit_log WHERE event = 'QUERY_OUTCOME' "
            "AND payload::jsonb ->> 'hallucination_flag' = 'true'").fetchone()["n"]
        claim_mismatches = conn.execute(
            "SELECT count(*) AS n FROM app.audit_log WHERE event = 'QUERY_OUTCOME' "
            "AND payload::jsonb ->> 'claim_mismatch' = 'true'").fetchone()["n"]
        pending = conn.execute("SELECT count(*) AS n FROM app.approvals WHERE status = 'PENDING'").fetchone()["n"]
        denied = conn.execute(
            "SELECT count(*) AS n FROM app.audit_log "
            "WHERE event IN ('ACCESS_DENIED', 'APPROVAL_ATTEMPT_DENIED')").fetchone()["n"]
        per_day = conn.execute(
            "SELECT created_at::date AS day, count(*) AS total, "
            "count(*) FILTER (WHERE status = 'COMPLETED') AS completed "
            "FROM app.queries WHERE created_at > now() - interval '14 days' "
            "GROUP BY 1 ORDER BY 1").fetchall()
    total = sum(by_status.values())
    return {
        "total": total,
        "by_status": by_status,
        "success_rate": by_status.get("COMPLETED", 0) / total if total else 0.0,
        "block_rate": by_status.get("BLOCKED", 0) / total if total else 0.0,
        "latency_p50_ms": lat["p50"], "latency_p95_ms": lat["p95"],
        "approvals_pending": pending, "hallucination_flags": flags,
        "claim_mismatch_count": claim_mismatches, "denied_events": denied,
        "per_day": [{**d, "day": str(d["day"])} for d in per_day],
    }


@router.get("/metrics/summary")
def summary(user: User = Depends(READERS)) -> dict:
    return collect()


@router.get("/metrics", response_class=PlainTextResponse)
def prometheus() -> str:
    """Prometheus text format. Aggregates only, no user data. Expose it on localhost or a private network."""
    m = collect()
    lines = ["# TYPE copilot_queries_total counter"]
    lines += [f'copilot_queries_total{{status="{s}"}} {n}' for s, n in m["by_status"].items()]
    lines += ["# TYPE copilot_approvals_pending gauge", f"copilot_approvals_pending {m['approvals_pending']}",
              "# TYPE copilot_hallucination_flags_total counter",
              f"copilot_hallucination_flags_total {m['hallucination_flags']}",
              "# TYPE copilot_claim_mismatch_total counter",
              f"copilot_claim_mismatch_total {m['claim_mismatch_count']}",
              "# TYPE copilot_denied_events_total counter", f"copilot_denied_events_total {m['denied_events']}"]
    for q, key in (("0.5", "latency_p50_ms"), ("0.95", "latency_p95_ms")):
        if m[key] is not None:
            lines.append(f'copilot_query_latency_ms{{quantile="{q}"}} {m[key]:.0f}')
    return "\n".join(lines) + "\n"
