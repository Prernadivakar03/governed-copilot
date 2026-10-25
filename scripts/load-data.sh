#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
docker compose exec -T backend python -m scripts.load_olist
docker compose exec -T backend python -m scripts.setup_roles
