$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Created .env from .env.example. Edit its placeholders before starting services.'
}

$venvPython = Join-Path $root 'backend/.venv/Scripts/python.exe'
if (-not (Test-Path $venvPython)) {
    python -m venv (Join-Path $root 'backend/.venv')
}
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $root 'backend/requirements.txt')
$devRequirements = Join-Path $root 'backend/requirements-dev.txt'
if (Test-Path $devRequirements) {
    & $venvPython -m pip install -r $devRequirements
}
npm --prefix frontend ci
