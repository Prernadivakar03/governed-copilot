import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    "gold": "eval/gold.jsonl",
    "semantic": "backend/app/semantic/semantic.yaml",
    "prompt": "backend/app/generation/prompt.py",
    "llm": "backend/app/generation/llm.py",
    "variants": "backend/app/variants.py",
}


def fingerprint() -> dict:
    sys.path.insert(0, str(ROOT / "backend"))
    from app.config import settings

    fp = {k: hashlib.sha256((ROOT / v).read_bytes()).hexdigest()[:16] for k, v in FILES.items()}
    fp["model"] = settings.ollama_model
    return fp