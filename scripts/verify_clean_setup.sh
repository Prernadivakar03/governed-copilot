#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "=== Verifying Clean Setup ==="
FAILED=0

# 1. Check .env exists
echo -n "[1/5] Checking .env file: "
if [ -f .env ]; then
    echo "OK (.env found)"
else
    echo "FAILED (.env missing)"
    FAILED=1
fi

# 2. Check docker compose config (report status if docker daemon is not reachable)
echo -n "[2/5] Checking docker compose configuration: "
if command -v docker >/dev/null 2>&1; then
    if docker compose config >/dev/null 2>&1; then
        echo "OK (compose config valid)"
    else
        if docker info >/dev/null 2>&1; then
            echo "FAILED (compose config invalid)"
            FAILED=1
        else
            echo "SKIPPED (Docker daemon not reachable / not running)"
        fi
    fi
else
    echo "SKIPPED (docker CLI not found)"
fi

# 3. Check DB health (pg_isready or python connection)
echo -n "[3/5] Checking database connection: "
DB_OK=0
if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h localhost -p 5432 -d copilot -U copilot >/dev/null 2>&1; then
        DB_OK=1
    fi
fi

PYTHON_CMD=""
if [ -f "$ROOT_DIR/backend/.venv/bin/python" ]; then
    PYTHON_CMD="$ROOT_DIR/backend/.venv/bin/python"
elif [ -f "$ROOT_DIR/backend/.venv/Scripts/python.exe" ]; then
    PYTHON_CMD="$ROOT_DIR/backend/.venv/Scripts/python.exe"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
fi

if [ $DB_OK -eq 0 ] && [ -n "$PYTHON_CMD" ]; then
    if "$PYTHON_CMD" -c "
import sys; sys.path.insert(0, 'backend'); from app.sandbox.executor import execute
res = execute('SELECT 1', 'analyst')
assert res.rows == [(1,)]
" >/dev/null 2>&1; then
        DB_OK=1
    fi
fi

if [ $DB_OK -eq 1 ]; then
    echo "OK (database accessible)"
else
    echo "FAILED (cannot connect to database)"
    FAILED=1
fi

# 4. Check backend responds on /health with 200
echo -n "[4/5] Checking backend /health endpoint: "
HEALTH_URL="http://127.0.0.1:8000/health"
HTTP_CODE=""
if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || true)
fi

if [ "$HTTP_CODE" = "200" ]; then
    echo "OK (HTTP 200)"
elif [ -n "$PYTHON_CMD" ]; then
    if "$PYTHON_CMD" -c "import urllib.request; resp = urllib.request.urlopen('$HEALTH_URL', timeout=5); assert resp.status == 200" >/dev/null 2>&1; then
        echo "OK (HTTP 200 via python)"
    else
        echo "FAILED"
        FAILED=1
    fi
else
    echo "FAILED (HTTP status: $HTTP_CODE)"
    FAILED=1
fi

# 5. Check frontend responds on 5173 or 8080
echo -n "[5/5] Checking frontend response: "
FE_OK=0
for HOST in localhost 127.0.0.1; do
    for PORT in 5173 8080; do
        FE_URL="http://$HOST:$PORT"
        FE_CODE=""
        if command -v curl >/dev/null 2>&1; then
            FE_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FE_URL" || true)
            if [ "$FE_CODE" = "200" ] || [ "$FE_CODE" = "304" ]; then
                echo "OK ($FE_URL responded with $FE_CODE)"
                FE_OK=1
                break 2
            fi
        fi
        if [ -z "$FE_CODE" ] && [ -n "$PYTHON_CMD" ]; then
            if "$PYTHON_CMD" -c "import urllib.request; resp = urllib.request.urlopen('$FE_URL', timeout=5); assert resp.status in (200, 304)" >/dev/null 2>&1; then
                echo "OK ($FE_URL responded with 200 via python)"
                FE_OK=1
                break 2
            fi
        fi
    done
done

if [ $FE_OK -eq 0 ]; then
    echo "FAILED (No response on port 5173 or 8080)"
    FAILED=1
fi

if [ $FAILED -eq 0 ]; then
    echo "=== All clean setup checks PASSED ==="
    exit 0
else
    echo "=== Clean setup checks FAILED ==="
    exit 1
fi
