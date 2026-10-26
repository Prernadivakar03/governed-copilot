"""Paired comparison for two full-system evaluation result JSON files."""
import argparse
import json
from pathlib import Path

import numpy as np


CLARIFY = {"CLARIFY", "CLARIFYING", "NEEDS_CLARIFICATION"}


def load(path: Path) -> dict:
    run = json.loads(path.read_text(encoding="utf-8"))
    return {row["id"]: row for row in run["results"]}


def compare(v1: dict, v2: dict, bootstrap: int = 10_000, seed: int = 17) -> dict:
    paired = [(key, v1[key], v2[key]) for key in sorted(v1.keys() & v2.keys())
              if v1[key].get("type") == "answer" and v2[key].get("type") == "answer"]
    if not paired:
        raise ValueError("no paired answerable questions found")
    delta = np.array([float(bool(new.get("ok"))) - float(bool(old.get("ok")))
                      for _, old, new in paired])
    rng = np.random.default_rng(seed)
    means = rng.choice(delta, size=(bootstrap, len(delta)), replace=True).mean(axis=1)
    fixed = int(np.sum((delta > 0)))
    broken = int(np.sum((delta < 0)))
    unchanged = int(np.sum(delta == 0))
    per_question = [{"id": key, "v1_ok": bool(old.get("ok")), "v2_ok": bool(new.get("ok")),
                     "outcome": "fixed" if new.get("ok") and not old.get("ok") else
                     "newly_broken" if old.get("ok") and not new.get("ok") else "unchanged"}
                    for key, old, new in paired]

    def clarify_count(rows: dict) -> int:
        return sum(r.get("status", "").upper() in CLARIFY
                   for r in rows.values() if r.get("type") == "answer")

    return {
        "n_paired_answerable": len(paired),
        "v1_accuracy": float(np.mean([bool(old.get("ok")) for _, old, _ in paired])),
        "v2_accuracy": float(np.mean([bool(new.get("ok")) for _, _, new in paired])),
        "accuracy_difference": float(delta.mean()),
        "accuracy_difference_95_ci": [float(v) for v in np.percentile(means, [2.5, 97.5])],
        "fixed": fixed,
        "newly_broken": broken,
        "unchanged": unchanged,
        "over_clarification_v1": clarify_count(v1),
        "over_clarification_v2": clarify_count(v2),
        "per_question": per_question,
    }


def percent(metric: dict | None) -> str:
    value = metric.get("value") if metric else None
    return "unavailable" if value is None else f"{value * 100:.1f}%"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("v1", type=Path, help="v1 full run result JSON")
    ap.add_argument("v2", type=Path, help="v2 full run result JSON")
    ap.add_argument("--bootstrap", type=int, default=10_000)
    args = ap.parse_args()
    old_run = json.loads(args.v1.read_text(encoding="utf-8"))
    new_run = json.loads(args.v2.read_text(encoding="utf-8"))
    report = compare(load(args.v1), load(args.v2), args.bootstrap)
    v2_summary = new_run.get("summary", {})
    report["v2_unauthorized_access_rate"] = v2_summary.get("unauthorized_access_rate", {}).get("value")
    report["v2_security_block_rate"] = v2_summary.get("security_block_rate", {}).get("value")
    report["v1_file"] = str(args.v1)
    report["v2_file"] = str(args.v2)
    print(json.dumps(report, indent=2))
    print(f"\nOver-clarification: v1 {report['over_clarification_v1']} | v2 {report['over_clarification_v2']}")
    print(f"v2 unauthorized-access rate: {percent(v2_summary.get('unauthorized_access_rate'))}")
    print(f"v2 security-block rate: {percent(v2_summary.get('security_block_rate'))}")


if __name__ == "__main__":
    main()
