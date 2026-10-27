#!/usr/bin/env bash
set -euo pipefail

# MDS-25 Governed Analytics Copilot: One-command startup script
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DATASET_PATH="${1:-${OLIST_DATA_PATH:-data/raw}}"

echo "==> [1/5] Checking environment configuration..."
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

# Generate JWT_SECRET if empty or default
if grep -q "JWT_SECRET=$" .env 2>/dev/null || grep -q "JWT_SECRET=\"\"" .env 2>/dev/null || ! grep -q "JWT_SECRET=" .env; then
    NEW_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))" 2>/dev/null || openssl rand -base64 48 | tr -dc 'a-zA-Z0-9_-')
    if grep -q "JWT_SECRET=" .env; then
        sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_SECRET}|" .env && rm -f .env.bak
    else
        echo "JWT_SECRET=${NEW_SECRET}" >> .env
    fi
    echo "Generated fresh JWT_SECRET in .env."
fi

echo "==> [2/5] Starting Docker Compose services (db, backend, frontend)..."
docker compose up -d --build

echo "==> [3/5] Waiting for services to become healthy..."
MAX_WAIT=90
ELAPSED=0
until docker compose ps db --format json 2>/dev/null | grep -q '"Health": "healthy"' || [ $ELAPSED -ge $MAX_WAIT ]; do
    sleep 2
    ELAPSED=$((ELAPSED + 2))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "ERROR: Timed out waiting for PostgreSQL container to become healthy."
    docker compose logs db
    exit 1
fi

echo "==> [4/5] Initializing database, RBAC roles, and demo users..."
docker compose exec -T backend python backend/scripts/init_app_db.py
docker compose exec -T backend python backend/scripts/setup_roles.py
docker compose exec -T backend python backend/scripts/seed_users.py

echo "==> [5/5] Loading Olist dataset and creating composite analytical indexes..."
docker compose exec -T backend python backend/scripts/load_olist.py --data-path "$DATASET_PATH"
docker compose exec -T backend python backend/scripts/optimize_indexes.py

echo ""
echo "=========================================================================="
echo " Governed Analytics Copilot is RUNNING"
echo "=========================================================================="
echo " Frontend:  http://localhost:5173"
echo " Backend:   http://localhost:8000 (Docs: http://localhost:8000/docs)"
echo ""
echo " Demo Roles (Single password: see SEED_USER_PASSWORD in .env):"
echo "  - Analyst: alice (analytics without PII access)"
echo "  - Steward: sam   (full schema with PII access, approval reviewer)"
echo "  - Auditor: audrey (audit trail & research evaluation viewer)"
echo "  - Admin:   adam  (full system administration & telemetry)"
echo "=========================================================================="
