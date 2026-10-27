#!/usr/bin/env python3
"""Repository hygiene check.
Fails if .env, .venv, caches, or datasets are tracked by git.
"""
import fnmatch
import subprocess
import sys

FORBIDDEN_PATTERNS = [
    ".env",
    ".env.local",
    "*.env",
    ".venv*",
    "*/.venv*",
    "*.pyc",
    "*__pycache__*",
    "*.pytest_cache*",
    "*.ruff_cache*",
    "*.cache*",
    "*node_modules*",
    "data/raw/*",
    "*.csv",
    "*.parquet",
]

ALLOWED_EXCEPTIONS = {
    ".env.example",
    "docs/results/REPORT_OUTPUT.txt",
}


def main() -> None:
    try:
        res = subprocess.run(
            ["git", "ls-files"],
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.SubprocessError, OSError) as e:
        print(f"ERROR: Failed to run git ls-files: {e}", file=sys.stderr)
        sys.exit(2)

    tracked_files = [line.strip() for line in res.stdout.splitlines() if line.strip()]
    violations: list[tuple[str, str]] = []

    for path in tracked_files:
        norm_path = path.replace("\\", "/")
        if norm_path in ALLOWED_EXCEPTIONS:
            continue
        for pattern in FORBIDDEN_PATTERNS:
            if fnmatch.fnmatch(norm_path, pattern) or fnmatch.fnmatch(norm_path.split("/")[-1], pattern):
                violations.append((norm_path, pattern))
                break

    if violations:
        print("FAILED: Repository hygiene check failed. The following tracked files violate hygiene policy:", file=sys.stderr)
        for path, pattern in violations:
            print(f"  - {path} (matched '{pattern}')", file=sys.stderr)
        print("\nTo fix, remove them from git tracking using: git rm --cached <file>", file=sys.stderr)
        sys.exit(1)

    print("Repository hygiene check PASSED: No secrets, virtual environments, caches, or datasets tracked.")
    sys.exit(0)


if __name__ == "__main__":
    main()
