"""Result checks: every number in an answer must appear in the SQL result."""
import re

SCALE = {"thousand": 1e3, "k": 1e3, "million": 1e6, "m": 1e6, "billion": 1e9, "bn": 1e9}
NUM = re.compile(r"(?<![\w.])(-?\d[\d,]*(?:\.\d+)?)(?:\s*(thousand|million|billion|bn|k|m)\b)?", re.I)

# column-name fragment -> (min, max)
RANGES = {"review_score": (1, 5), "pct": (0, 100), "percent": (0, 100)}
NON_NEGATIVE = ("count", "price", "revenue", "total", "sum", "freight", "value", "number")


def claimed_numbers(text: str) -> list[tuple[float, float]]:
    """(value, rounding tolerance) for each number in text. '13.2 million' -> (13.2e6, 50000)."""
    out: list[tuple[float, float]] = []
    for m in NUM.finditer(text):
        raw = m.group(1).replace(",", "")
        try:
            val = float(raw)
        except ValueError:
            continue
        scale = SCALE.get((m.group(2) or "").lower(), 1.0)
        decimals = len(raw.split(".")[1]) if "." in raw else 0
        out.append((val * scale, 0.5 * (10 ** -decimals) * scale))
    return out


def result_numbers(columns: list[str], rows: list[list]) -> set[float]:
    vals: set[float] = set()
    for row in rows:
        for v in row:
            if isinstance(v, bool):
                continue
            if isinstance(v, (int, float)):
                vals.add(float(v))
            elif isinstance(v, str):
                vals.update(x for x, _ in claimed_numbers(v))
    vals.update({float(len(rows)), float(len(columns))})
    vals.update({v * 100 for v in list(vals) if 0 < abs(v) <= 1})  # 0.123 may be written 12.3%
    return vals


def ungrounded_numbers(answer: str, columns: list[str], rows: list[list], question: str = "") -> list[float]:
    """Numbers in the answer that appear nowhere in the result (or the question)."""
    allowed = result_numbers(columns, rows) | {x for x, _ in claimed_numbers(question)}
    return [x for x, tol in claimed_numbers(answer)
            if not any(abs(x - v) <= tol + 1e-9 for v in allowed)]


def sanity_flags(columns: list[str], rows: list[list], truncated: bool) -> list[str]:
    flags: list[str] = []
    if not rows:
        flags.append("empty result")
    if truncated:
        flags.append("result truncated at the row cap")
    for j, name in enumerate(columns):
        low = name.lower()
        nums = [r[j] for r in rows if isinstance(r[j], (int, float)) and not isinstance(r[j], bool)]
        if not nums:
            continue
        if any(k in low for k in NON_NEGATIVE) and min(nums) < 0:
            flags.append(f"negative values in {name}")
        for frag, (lo, hi) in RANGES.items():
            if frag in low and (min(nums) < lo or max(nums) > hi):
                flags.append(f"{name} outside expected range {lo}-{hi}")
    return flags