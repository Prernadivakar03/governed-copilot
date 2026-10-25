r"""Validate gold.jsonl before using it.   Usage (repo root):  python eval\check_gold.py"""
import json
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import psycopg
from app.sandbox.executor import execute

gold = [json.loads(line) for line in (ROOT / "eval" / "gold.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
problems: list[str] = []

for q, n in Counter(q["id"] for q in gold).items():
    if n > 1:
        problems.append(f"duplicate id {q}")

for q in gold:
    for key in ("id", "question", "role", "difficulty", "type"):
        if key not in q:
            problems.append(f"{q.get('id', '?')}: missing {key}")
    if q["type"] == "refuse" and not q.get("tag"):
        problems.append(f"{q['id']}: refuse question needs a tag")
    if q["type"] == "answer":
        t0 = time.perf_counter()
        try:
            ex = execute(q["reference_sql"], q["role"], max_rows=100000, timeout_ms=60000)
        except psycopg.Error as e:
            problems.append(f"{q['id']}: reference SQL failed: {str(e).splitlines()[0]}")
            continue
        if not ex.rows or all(v is None for v in ex.rows[0]):
            problems.append(f"{q['id']}: reference result is empty or NULL")
        print(f"ok  {q['id']:4} {len(ex.rows):6} rows  {time.perf_counter() - t0:5.1f}s")

kinds = Counter(q["type"] for q in gold)
print("\n", dict(kinds), "adversarial share:", f"{kinds['refuse'] / len(gold):.0%}")
print(dict(Counter(q["difficulty"] for q in gold)))
if problems:
    print("\nPROBLEMS:")
    print("\n".join(" - " + p for p in problems))
    raise SystemExit(1)
print("gold set OK")