#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
if (($# == 0)); then
  backend/.venv/bin/python eval/run_eval.py full
else
  backend/.venv/bin/python eval/run_eval.py "$@"
fi
