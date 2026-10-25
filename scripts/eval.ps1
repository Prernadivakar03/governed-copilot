$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
$python = Join-Path $root 'backend/.venv/Scripts/python.exe'
if ($args.Count -eq 0) {
    & $python 'eval/run_eval.py' 'full'
} else {
    & $python 'eval/run_eval.py' @args
}
