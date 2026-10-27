$ErrorActionPreference = "Stop"
$ROOT_DIR = Split-Path -Parent $PSScriptRoot
Set-Location $ROOT_DIR

Write-Host "=== Verifying Clean Setup ===" -ForegroundColor Cyan
$FAILED = 0

# 1. Check .env exists
Write-Host -NoNewline "[1/5] Checking .env file: "
if (Test-Path ".env") {
    Write-Host "OK (.env found)" -ForegroundColor Green
} else {
    Write-Host "FAILED (.env missing)" -ForegroundColor Red
    $FAILED = 1
}

# 2. Check docker compose config
Write-Host -NoNewline "[2/5] Checking docker compose configuration: "
try {
    $composeOut = & docker compose config 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK (compose config valid)" -ForegroundColor Green
    } else {
        $daemonRunning = $false
        try {
            $infoOut = & docker info 2>&1
            if ($LASTEXITCODE -eq 0) { $daemonRunning = $true }
        } catch {}

        if ($daemonRunning) {
            Write-Host "FAILED (compose config invalid)" -ForegroundColor Red
            $FAILED = 1
        } else {
            Write-Host "SKIPPED (Docker daemon not reachable / not running)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "SKIPPED (docker CLI not found)" -ForegroundColor Yellow
}

# 3. Check DB health
Write-Host -NoNewline "[3/5] Checking database connection: "
$DB_OK = $false
try {
    $pythonCmd = ".\backend\.venv\Scripts\python.exe"
    if (-not (Test-Path $pythonCmd)) { $pythonCmd = "python" }
    $dbTest = & $pythonCmd -c "import sys; sys.path.insert(0, 'backend'); from app.sandbox.executor import execute; res = execute('SELECT 1', 'analyst'); assert res.rows == [(1,)]" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $DB_OK = $true
    }
} catch {}

if ($DB_OK) {
    Write-Host "OK (database accessible)" -ForegroundColor Green
} else {
    Write-Host "FAILED (cannot connect to database)" -ForegroundColor Red
    $FAILED = 1
}

# 4. Check backend responds on /health with 200
Write-Host -NoNewline "[4/5] Checking backend /health endpoint: "
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -TimeoutSec 5 -UseBasicParsing
    if ($resp.StatusCode -eq 200) {
        Write-Host "OK (HTTP 200)" -ForegroundColor Green
    } else {
        Write-Host "FAILED (HTTP $($resp.StatusCode))" -ForegroundColor Red
        $FAILED = 1
    }
} catch {
    Write-Host "FAILED ($($_.Exception.Message))" -ForegroundColor Red
    $FAILED = 1
}

# 5. Check frontend responds on 5173 or 8080
Write-Host -NoNewline "[5/5] Checking frontend response: "
$FE_OK = $false
foreach ($hostName in @("localhost", "127.0.0.1")) {
    foreach ($port in @(5173, 8080)) {
        try {
            $feResp = Invoke-WebRequest -Uri "http://${hostName}:${port}" -TimeoutSec 5 -UseBasicParsing
            if ($feResp.StatusCode -in @(200, 304)) {
                Write-Host "OK (http://${hostName}:${port} responded with $($feResp.StatusCode))" -ForegroundColor Green
                $FE_OK = $true
                break
            }
        } catch {}
    }
    if ($FE_OK) { break }
}

if (-not $FE_OK) {
    Write-Host "FAILED (No response on port 5173 or 8080)" -ForegroundColor Red
    $FAILED = 1
}

if ($FAILED -eq 0) {
    Write-Host "=== All clean setup checks PASSED ===" -ForegroundColor Green
    exit 0
} else {
    Write-Host "=== Clean setup checks FAILED ===" -ForegroundColor Red
    exit 1
}
