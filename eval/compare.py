"""Paired comparison and statistical evaluation for text-to-SQL benchmark runs.

Reports:
- Paired accuracy on identical question sets
- Counts of fixed, broken, and unchanged
- McNemar exact two-sided p-value
- Paired bootstrap 95% confidence interval for accuracy difference
- Sub-group metrics: answerable, unanswerable/CLARIFY-expected, security
- Multi-run mean and spread when multiple seed files are provided
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
from scipy.stats import binomtest

CLARIFY = {"CLARIFY", "CLARIFYING", "NEEDS_CLARIFICATION"}
SECURITY_TAGS = {"pii", "unauthorized", "injection", "destructive"}


def load_run(path: Path) -> tuple[dict[str, Any], dict[str, dict]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    meta = data.get("meta", {})
    summary = data.get("summary", {})
    results = {row["id"]: row for row in data.get("results", [])}
    return {"meta": meta, "summary": summary, "path": str(path)}, results


def mcnemar_exact_pvalue(b: int, c: int) -> float:
    """Exact two-sided McNemar test using Binomial distribution under H0: p=0.5."""
    n = b + c
    if n == 0:
        return 1.0
    res = binomtest(b, n=n, p=0.5, alternative="two-sided")
    return float(res.pvalue)


def paired_stats_for_subset(paired: list[tuple[str, dict, dict]],
                            name: str,
                            bootstrap: int = 10_000,
                            seed: int = 42) -> dict[str, Any]:
    n = len(paired)
    if n == 0:
        return {
            "subset": name,
            "n": 0,
            "v1_accuracy": None,
            "v2_accuracy": None,
            "accuracy_difference": None,
            "accuracy_difference_95_ci": [None, None],
            "fixed": 0,
            "broken": 0,
            "unchanged": 0,
            "mcnemar_p_value": None,
            "statistically_significant": False,
        }

    v1_scores = np.array([float(bool(old.get("ok"))) for _, old, _ in paired])
    v2_scores = np.array([float(bool(new.get("ok"))) for _, _, new in paired])
    delta = v2_scores - v1_scores

    fixed = int(np.sum((v1_scores == 0) & (v2_scores == 1)))
    broken = int(np.sum((v1_scores == 1) & (v2_scores == 0)))
    unchanged = int(np.sum(v1_scores == v2_scores))

    p_value = mcnemar_exact_pvalue(fixed, broken)

    rng = np.random.default_rng(seed)
    boot_means = rng.choice(delta, size=(bootstrap, n), replace=True).mean(axis=1)
    ci_low, ci_high = np.percentile(boot_means, [2.5, 97.5])

    return {
        "subset": name,
        "n": n,
        "v1_accuracy": float(v1_scores.mean()),
        "v2_accuracy": float(v2_scores.mean()),
        "accuracy_difference": float(delta.mean()),
        "accuracy_difference_95_ci": [float(ci_low), float(ci_high)],
        "fixed": fixed,
        "broken": broken,
        "unchanged": unchanged,
        "mcnemar_p_value": p_value,
        "statistically_significant": bool(p_value < 0.05),
    }


def compare_single_pair(v1_results: dict[str, dict],
                        v2_results: dict[str, dict],
                        bootstrap: int = 10_000,
                        seed: int = 42) -> dict[str, Any]:
    common_ids = sorted(v1_results.keys() & v2_results.keys())
    if not common_ids:
        raise ValueError("No common question IDs found between runs.")

    all_paired = [(qid, v1_results[qid], v2_results[qid]) for qid in common_ids]
    answerable = [(qid, o, n) for qid, o, n in all_paired if o.get("type") == "answer" and n.get("type") == "answer"]
    unanswerable = [(qid, o, n) for qid, o, n in all_paired if o.get("tag") == "unanswerable" or n.get("tag") == "unanswerable"]
    security = [(qid, o, n) for qid, o, n in all_paired if o.get("tag") in SECURITY_TAGS or n.get("tag") in SECURITY_TAGS]

    stats_overall = paired_stats_for_subset(all_paired, "overall", bootstrap, seed)
    stats_answerable = paired_stats_for_subset(answerable, "answerable", bootstrap, seed)
    stats_unanswerable = paired_stats_for_subset(unanswerable, "unanswerable", bootstrap, seed)
    stats_security = paired_stats_for_subset(security, "security", bootstrap, seed)

    per_question = []
    for qid, old, new in all_paired:
        old_ok = bool(old.get("ok"))
        new_ok = bool(new.get("ok"))
        outcome = "fixed" if new_ok and not old_ok else ("broken" if old_ok and not new_ok else "unchanged")
        per_question.append({
            "id": qid,
            "type": old.get("type"),
            "tag": old.get("tag"),
            "v1_ok": old_ok,
            "v2_ok": new_ok,
            "outcome": outcome,
            "v1_status": old.get("status"),
            "v2_status": new.get("status"),
        })

    def count_clarify(results: dict[str, dict]) -> int:
        return sum(1 for r in results.values() if str(r.get("status", "")).upper() in CLARIFY and r.get("type") == "answer")

    return {
        "n_paired_total": len(all_paired),
        "overall": stats_overall,
        "answerable": stats_answerable,
        "unanswerable": stats_unanswerable,
        "security": stats_security,
        "over_clarification_v1": count_clarify(v1_results),
        "over_clarification_v2": count_clarify(v2_results),
        "per_question": per_question,
    }


def multi_run_summary(runs: list[dict[str, dict]]) -> dict[str, Any]:
    """Calculate mean and spread across multiple seed evaluations."""
    accuracies = []
    hallucinations = []
    latencies_p50 = []
    latencies_p95 = []

    for r in runs:
        res_list = list(r.values())
        if not res_list:
            continue
        acc = np.mean([bool(x.get("ok")) for x in res_list])
        accuracies.append(acc)

        # Hallucination rate
        halluc_items = [x.get("hallucination") for x in res_list if x.get("hallucination") is not None]
        if halluc_items:
            hallucinations.append(np.mean([bool(h) for h in halluc_items]))

        lats = [x.get("latency_ms", 0) / 1000.0 for x in res_list if x.get("latency_ms") is not None]
        if lats:
            latencies_p50.append(np.percentile(lats, 50))
            latencies_p95.append(np.percentile(lats, 95))

    return {
        "n_runs": len(runs),
        "accuracy": {
            "mean": float(np.mean(accuracies)) if accuracies else None,
            "std": float(np.std(accuracies)) if len(accuracies) > 1 else 0.0,
            "min": float(np.min(accuracies)) if accuracies else None,
            "max": float(np.max(accuracies)) if accuracies else None,
            "values": [float(x) for x in accuracies],
        },
        "hallucination": {
            "mean": float(np.mean(hallucinations)) if hallucinations else None,
            "std": float(np.std(hallucinations)) if len(hallucinations) > 1 else 0.0,
            "values": [float(x) for x in hallucinations],
        },
        "latency_p50_s": {
            "mean": float(np.mean(latencies_p50)) if latencies_p50 else None,
            "values": [float(x) for x in latencies_p50],
        },
        "latency_p95_s": {
            "mean": float(np.mean(latencies_p95)) if latencies_p95 else None,
            "values": [float(x) for x in latencies_p95],
        },
    }


def format_pct(val: float | None) -> str:
    return "N/A" if val is None else f"{val * 100:.1f}%"


def print_comparison_table(report: dict[str, Any]) -> None:
    print("\n" + "=" * 80)
    print("PAIRED EVALUATION & STATISTICAL COMPARISON REPORT")
    print("=" * 80)

    subsets = [("Overall", "overall"), ("Answerable", "answerable"),
               ("Unanswerable / Clarify", "unanswerable"), ("Security / Robustness", "security")]

    print(f"{'Subset':<25} | {'N':<4} | {'V1 Acc':<8} | {'V2 Acc':<8} | {'Diff (V2-V1)':<12} | {'95% CI':<18} | {'p-value':<9} | {'Sig?':<5}")
    print("-" * 100)

    for label, key in subsets:
        s = report[key]
        n = s["n"]
        if n == 0:
            print(f"{label:<25} | {0:<4} | {'-':<8} | {'-':<8} | {'-':<12} | {'-':<18} | {'-':<9} | {'-':<5}")
            continue
        v1_a = format_pct(s["v1_accuracy"])
        v2_a = format_pct(s["v2_accuracy"])
        diff_str = f"{(s['accuracy_difference'] * 100):+.1f}%"
        ci = s["accuracy_difference_95_ci"]
        ci_str = f"[{ci[0]*100:+.1f}%, {ci[1]*100:+.1f}%]"
        p_val = f"{s['mcnemar_p_value']:.4f}"
        sig = "YES" if s["statistically_significant"] else "NO"
        print(f"{label:<25} | {n:<4} | {v1_a:<8} | {v2_a:<8} | {diff_str:<12} | {ci_str:<18} | {p_val:<9} | {sig:<5}")

    print("-" * 100)
    ov = report["overall"]
    print(f"Outcome Counts: Fixed = {ov['fixed']} | Broken = {ov['broken']} | Unchanged = {ov['unchanged']}")
    print(f"Over-clarification on answerable queries: V1 = {report['over_clarification_v1']} | V2 = {report['over_clarification_v2']}")
    p = ov['mcnemar_p_value']
    if ov["statistically_significant"]:
        print(f"Conclusion: The accuracy difference is STATISTICALLY SIGNIFICANT (McNemar exact p = {p:.4f} < 0.05).")
    else:
        print(f"Conclusion: The accuracy difference is NOT statistically significant (McNemar exact p = {p:.4f} >= 0.05).")
    print("=" * 80 + "\n")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("v1_files", nargs="+", type=Path, help="V1 run result JSON file(s)")
    ap.add_argument("--v2", nargs="+", type=Path, required=True, help="V2 run result JSON file(s)")
    ap.add_argument("--bootstrap", type=int, default=10_000)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--json", action="store_true", help="Output machine-readable JSON")
    args = ap.parse_args()

    v1_runs = [load_run(p)[1] for p in args.v1_files]
    v2_runs = [load_run(p)[1] for p in args.v2]

    # Primary paired comparison between first pair (or single runs)
    report = compare_single_pair(v1_runs[0], v2_runs[0], bootstrap=args.bootstrap, seed=args.seed)

    if len(v1_runs) > 1 or len(v2_runs) > 1:
        report["multi_run_v1"] = multi_run_summary(v1_runs)
        report["multi_run_v2"] = multi_run_summary(v2_runs)

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print_comparison_table(report)
        if "multi_run_v1" in report and "multi_run_v2" in report:
            m1 = report["multi_run_v1"]["accuracy"]
            m2 = report["multi_run_v2"]["accuracy"]
            print(f"V1 Multi-run (n={len(v1_runs)}): mean {m1['mean']*100:.1f}% (spread: min {m1['min']*100:.1f}%, max {m1['max']*100:.1f}%, std {m1['std']*100:.2f}%)")
            print(f"V2 Multi-run (n={len(v2_runs)}): mean {m2['mean']*100:.1f}% (spread: min {m2['min']*100:.1f}%, max {m2['max']*100:.1f}%, std {m2['std']*100:.2f}%)")


if __name__ == "__main__":
    main()
