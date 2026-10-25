$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location (Join-Path $root 'backend')
& (Join-Path $root 'backend/.venv/Scripts/python.exe') -m ruff check .
