$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
docker compose exec -T backend python -m scripts.load_olist
docker compose exec -T backend python -m scripts.setup_roles
