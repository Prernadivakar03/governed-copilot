"""Pytest fixtures and automatic markers for unit vs integration tests.
Ensures unit tests need no live services and integration tests skip cleanly with connection timeouts.
"""
from __future__ import annotations

import functools
from pathlib import Path

import httpx
import psycopg
import pytest
from app.config import settings

UNIT_FILES = {
    "test_validator.py",
    "test_policy.py",
    "test_semantic.py",
    "test_tools.py",
    "test_grounding.py",
    "test_prompt.py",
    "test_conflicts.py",
    "test_catalog_poison.py",
}


@functools.lru_cache(maxsize=1)
def check_postgres(timeout_s: float = 1.0) -> bool:
    """Check if PostgreSQL is reachable within connection timeout."""
    try:
        with (
            psycopg.connect(
                settings.admin_conninfo(),
                connect_timeout=max(1, int(timeout_s)),
                autocommit=True,
            ) as conn,
            conn.cursor() as cur,
        ):
            cur.execute("SELECT 1")
            return True
    except (psycopg.Error, OSError, TimeoutError):
        return False


@functools.lru_cache(maxsize=1)
def check_ollama(timeout_s: float = 1.0) -> bool:
    """Check if Ollama is reachable within timeout."""
    try:
        r = httpx.get(f"{settings.ollama_url}/api/tags", timeout=timeout_s)
        return r.status_code == 200
    except (httpx.HTTPError, OSError, TimeoutError):
        return False


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Categorize and tag collected tests as either unit or integration."""
    for item in items:
        file_name = Path(item.fspath).name
        if file_name in UNIT_FILES:
            item.add_marker(pytest.mark.unit)
        else:
            item.add_marker(pytest.mark.integration)


def pytest_runtest_setup(item: pytest.Item) -> None:
    """Skip integration tests cleanly if required services are unreachable."""
    if item.get_closest_marker("integration"):
        if not check_postgres():
            pytest.skip("PostgreSQL is not reachable (connection timeout)")
        test_path = str(item.fspath).lower()
        if (
            any(kw in item.name.lower() or kw in test_path for kw in ("ollama", "llm", "pipeline", "startup"))
            and not check_ollama()
        ):
            pytest.skip("Ollama is not reachable (connection timeout)")
