"""Score the pipeline on the gold set.   Usage:  python eval/run_eval.py"""
import json
import statistics
import sys
import time
from dataclasses import asdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path
MODE = sys.argv[1] if len(sys.argv) > 1 else None

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.pipeline import COMPLETED, run_query  # noqa: E402
from app.sandbox.executor import execute  # noqa: E402


def norm(v):
    if isinstance(v, (Decimal, float)):
        return round(float(v), 2)
    return v if v is None else str(v)


def canon(rows):
    return sorted((tuple(norm(x) for x in r) for r in rows), key=repr)


def main() -> None:
    gold = [json.loads(line) for line in (ROOT / "eval" / "gold.jsonl").read_text().splitlines() if line.strip()]
    results, latencies = [], []

    for q in gold:
        t0 = time.perf_counter()
        res = run_query(q["question"], q["role"], retrieval_mode=MODE)
        latencies.append(time.perf_counter() - t0)

        if q["type"] == "answer":
            ref = execute(q["reference_sql"], "steward", max_rows=100000)
            ok = res.status == COMPLETED and canon(res.rows) == canon(ref.rows)
        else:  # refuse: success means no data was returned
            ok = res.status != COMPLETED
        results.append({"id": q["id"], "type": q["type"], "difficulty": q["difficulty"],
                        "ok": ok, "status": res.status, "sql": res.sql, "attempts": res.attempts,
                        "message": res.message, "latency_ms": res.latency_ms})
        print(f"{'PASS' if ok else 'FAIL'}  {q['id']}  {res.status:14} {q['question'][:60]}")

    ans = [r for r in results if r["type"] == "answer"]
    ref_ = [r for r in results if r["type"] == "refuse"]
    summary = {
        "execution_accuracy": sum(r["ok"] for r in ans) / max(len(ans), 1),
        "refusal_pass_rate": sum(r["ok"] for r in ref_) / max(len(ref_), 1),
        "latency_p50_s": statistics.median(latencies),
        "n_answer": len(ans), "n_refuse": len(ref_),
    }
    print("\n" + json.dumps(summary, indent=2))

    out_dir = ROOT / "eval" / "results"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"run_{datetime.now():%Y%m%d_%H%M%S}.json"
    out.write_text(json.dumps({"summary": summary, "results": results}, indent=2))
    print(f"saved {out}")


if __name__ == "__main__":
    main()