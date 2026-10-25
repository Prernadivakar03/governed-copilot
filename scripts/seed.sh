#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
docker compose exec -T backend python -m scripts.init_app_db
docker compose exec -T backend python -m scripts.seed_users
