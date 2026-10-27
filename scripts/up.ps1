param(
    [string]$DatasetPath = "data/raw"
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

Write-Host "==> [1/5] Checking environment configuration..." -ForegroundColor Cyan
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"
}

# Generate JWT_SECRET if missing or empty
$envContent = Get-Content ".env" -Raw
if ($envContent -match "JWT_SECRET=\s*$" -or $envContent -notmatch "JWT_SECRET=") {
    $bytes = New-Object byte[] 36
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $newSecret = [System.Convert]::ToBase64String($bytes) -replace '[/+=]', '_'
    if ($envContent -match "JWT_SECRET=") {
        $envContent = $envContent -replace "JWT_SECRET=.*", "JWT_SECRET=$newSecret"
    } else {
        $envContent += "`nJWT_SECRET=$newSecret`n"
    }
    Set-Content ".env" $envContent
    Write-Host "Generated fresh JWT_SECRET in .env." -ForegroundColor Green
}

Write-Host "==> [2/5] Starting Docker Compose services (db, backend, frontend)..." -ForegroundColor Cyan
docker compose up -d --build

Write-Host "==> [3/5] Waiting for services to become healthy..." -ForegroundColor Cyan
$maxWait = 90
$elapsed = 0
$healthy = $false

while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 2
    $elapsed += 2
    $dbStatus = docker compose ps db --format json 2>$null | ConvertFrom-Json
    if ($dbStatus -and $dbStatus.Health -eq "healthy") {
        $healthy = $true
        break
    }
}

if (-not $healthy) {
    Write-Host "ERROR: Timed out waiting for PostgreSQL container to become healthy." -ForegroundColor Red
    docker compose logs db
    exit 1
}

Write-Host "==> [4/5] Initializing database, RBAC roles, and demo users..." -ForegroundColor Cyan
docker compose exec -T backend python backend/scripts/init_app_db.py
docker compose exec -T backend python backend/scripts/setup_roles.py
docker compose exec -T backend python backend/scripts/seed_users.py

Write-Host "==> [5/5] Loading Olist dataset and creating composite analytical indexes..." -ForegroundColor Cyan
docker compose exec -T backend python backend/scripts/load_olist.py --data-path $DatasetPath
docker compose exec -T backend python backend/scripts/optimize_indexes.py

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host " Governed Analytics Copilot is RUNNING" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host " Frontend:  http://localhost:5173"
Write-Host " Backend:   http://localhost:8000 (Docs: http://localhost:8000/docs)"
Write-Host ""
Write-Host " Demo Roles (Single password: see SEED_USER_PASSWORD in .env):"
Write-Host "  - Analyst: alice (analytics without PII access)"
Write-Host "  - Steward: sam   (full schema with PII access, approval reviewer)"
Write-Host "  - Auditor: audrey (audit trail & research evaluation viewer)"
Write-Host "  - Admin:   adam  (full system administration & telemetry)"
Write-Host "==========================================================================" -ForegroundColor Green
