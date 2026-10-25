$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
docker compose exec -T backend python -m scripts.init_app_db
docker compose exec -T backend python -m scripts.seed_users
