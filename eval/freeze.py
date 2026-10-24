"""Record the protocol before final runs.   Usage:  python eval\freeze.py"""
import json
from pathlib import Path

from fingerprint import fingerprint

fp = fingerprint()
out = Path(__file__).with_name("frozen.json")
out.write_text(json.dumps(fp, indent=2), encoding="utf-8")
print("frozen:", json.dumps(fp, indent=2))