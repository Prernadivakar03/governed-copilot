"""Final evaluation script for held-out and fresh question benchmarks.
Only this script is authorized to load and evaluate on held-out data.
Enforces frozen SHA-256 fingerprint verification of held-out sets before execution.

Usage:
  python eval/run_final_eval.py SYSTEM [--dataset heldout|fresh|all_heldout|all_97|all_127] [--seed SEED] [--temperature TEMP] [--no-answer]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "eval"))

from app.config import settings
from app.pipeline import QueryResult, run_query
from app.sandbox.executor import execute
from app.variants import VARIANTS
from report import summarize
from run_eval import score


def get_commit_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    except (subprocess.SubprocessError, OSError):
        return "unknown"


def verify_heldout_integrity() -> None:
    split_file = ROOT / "eval" / "split.json"
    if not split_file.exists():
        raise SystemExit("ERROR: eval/split.json not found! Run scripts/create_eval_split.py first.")
    split = json.loads(split_file.read_text(encoding="utf-8"))
    heldout_file = ROOT / "eval" / "gold_heldout.jsonl"
    actual_hash = hashlib.sha256(heldout_file.read_bytes()).hexdigest()
    if actual_hash != split.get("heldout_file_sha256"):
        raise SystemExit(
            f"ERROR: Held-out integrity violation! eval/gold_heldout.jsonl has been tampered with or modified.\n"
            f"Expected SHA256: {split.get('heldout_file_sha256')}\n"
            f"Actual SHA256:   {actual_hash}"
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("system", choices=sorted(VARIANTS))
    ap.add_argument("--dataset", choices=["heldout", "fresh", "all_heldout", "all_97", "all_127"], default="all_heldout",
                    help="heldout (37), fresh (30), all_heldout (67), all_97 (original 97), all_127 (dev+heldout+fresh)")
    ap.add_argument("--no-answer", action="store_true", help="skip LLM answer writing")
    ap.add_argument("--seed", type=int, default=42, help="random seed for LLM generation")
    ap.add_argument("--temperature", type=float, default=0.0, help="sampling temperature")
    args = ap.parse_args()

    # Always verify held-out fingerprint before running
    verify_heldout_integrity()

    settings.llm_seed = args.seed
    settings.llm_temperature = args.temperature
    if args.no_answer:
        settings.llm_answer = False
    variant = VARIANTS[args.system]

    heldout_file = ROOT / "eval" / "gold_heldout.jsonl"
    fresh_file = ROOT / "eval" / "holdout_fresh.jsonl"
    dev_file = ROOT / "eval" / "gold_dev.jsonl"

    if args.dataset == "heldout":
        gold = [json.loads(line) for line in heldout_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    elif args.dataset == "fresh":
        gold = [json.loads(line) for line in fresh_file.read_text(encoding="utf-8").splitlines() if line.strip()]
    elif args.dataset == "all_heldout":
        h = [json.loads(line) for line in heldout_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        f = [json.loads(line) for line in fresh_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        gold = h + f
    elif args.dataset == "all_97":
        d = [json.loads(line) for line in dev_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        h = [json.loads(line) for line in heldout_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        gold = d + h
    elif args.dataset == "all_127":
        d = [json.loads(line) for line in dev_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        h = [json.loads(line) for line in heldout_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        f = [json.loads(line) for line in fresh_file.read_text(encoding="utf-8").splitlines() if line.strip()]
        gold = d + h + f

    refs = {q["id"]: execute(q["reference_sql"], q["role"], max_rows=100000, timeout_ms=60000).rows
            for q in gold if q["type"] == "answer"}

    print(f"Running {args.system} on {args.dataset} ({len(gold)} questions, seed={args.seed}, temp={args.temperature})...\n")

    results, fallbacks = [], 0
    for q in gold:
        try:
            res = run_query(q["question"], q["role"], variant=variant)
        except Exception as e:  # noqa: BLE001
            res = QueryResult(status="FAILED", question=q["question"], role=q["role"], message=type(e).__name__)
        rec = score(q, res, refs.get(q["id"]))
        retr = next((e for e in res.events if e["stage"] == "retrieve"), {})
        if variant.retrieval in ("bm25", "vector", "hybrid") and retr.get("mode") not in (None, variant.retrieval):
            rec["retrieval_fallback"] = True
            fallbacks += 1
        results.append(rec)
        print(f"{'PASS' if rec['ok'] else 'FAIL'}  {q['id']:4} {res.status:15} {q['question'][:58]}")

    summary = summarize(results)
    commit_sha = get_commit_sha()
    prompt_bytes = (ROOT / "backend/app/generation/prompt.py").read_bytes()
    prompt_hash = hashlib.sha256(prompt_bytes).hexdigest()[:16]

    run_config = {
        "model": settings.ollama_model,
        "temperature": settings.llm_temperature,
        "seed": settings.llm_seed,
        "commit_sha": commit_sha,
        "prompt_hash": prompt_hash,
        "dataset": args.dataset,
        "llm_cache": settings.llm_cache,
    }

    meta = {
        "system": args.system, "variant": asdict(variant),
        "dataset": args.dataset,
        "started": datetime.now(timezone.utc).isoformat(timespec="seconds"), "n": len(results),
        "llm_answer": settings.llm_answer, "llm_cache": settings.llm_cache,
        "run_config": run_config,
        "retrieval_fallbacks": fallbacks,
    }
    out_dir = ROOT / "eval" / "results"
    out_dir.mkdir(parents=True, exist_ok=True)
    timestamp = f"{datetime.now(timezone.utc):%Y%m%d_%H%M%S}"
    out = out_dir / f"final_{args.system}_{args.dataset}_{timestamp}_seed{args.seed}.json"
    config_out = out_dir / f"final_{args.system}_{args.dataset}_{timestamp}_seed{args.seed}.config.json"

    out.write_text(json.dumps({"meta": meta, "summary": summary, "results": results}, indent=2), encoding="utf-8")
    config_out.write_text(json.dumps(run_config, indent=2), encoding="utf-8")

    def pct(r: dict) -> str:
        return "-" if r["value"] is None else f"{r['value'] * 100:.1f}%"

    print(f"\nFINAL EVAL [{args.system}] ({args.dataset}, seed={args.seed}): exec acc {pct(summary['execution_accuracy'])} | "
          f"halluc {pct(summary['hallucination_rate'])} | unauthorized {pct(summary['unauthorized_access_rate'])} | "
          f"block {pct(summary['security_block_rate'])} | p50 {summary['latency_p50_s']:.1f}s")
    if fallbacks:
        print(f"WARNING: retrieval fell back to BM25 on {fallbacks} questions")
    print("saved", out)
    print("saved config", config_out)


if __name__ == "__main__":
    main()
