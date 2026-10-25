#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  printf '%s\n' 'Created .env from .env.example. Edit its placeholders before starting services.'
fi

if [[ ! -x backend/.venv/bin/python ]]; then
  python3 -m venv backend/.venv
fi
backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/python -m pip install -r backend/requirements.txt
if [[ -f backend/requirements-dev.txt ]]; then
  backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
fi
npm --prefix frontend ci
