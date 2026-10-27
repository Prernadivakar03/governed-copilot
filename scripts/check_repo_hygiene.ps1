$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
python "$RepoRoot\scripts\check_repo_hygiene.py"
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
