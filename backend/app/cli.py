import argparse
import json
from dataclasses import asdict

from app.pipeline import run_query

p = argparse.ArgumentParser()
p.add_argument("question")
p.add_argument("--role", default="analyst", choices=["analyst", "steward"])
args = p.parse_args()
print(json.dumps(asdict(run_query(args.question, args.role)), indent=2, default=str))