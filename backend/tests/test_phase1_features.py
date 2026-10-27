import psycopg
import pytest
from app.config import settings
from app.governance import tools
from app.pipeline import COMPLETED, FAILED, run_query
from app.semantic.loader import (
    allowed_map,
    compile_metric_template,
    load_semantic,
    restricted_names,
)
from app.validation.sql_validator import Rejected, validate

try:
    psycopg.connect(settings.admin_conninfo(), connect_timeout=3).close()
except psycopg.OperationalError:
    pytest.skip("database not available", allow_module_level=True)


def script(monkeypatch, outputs):
    calls = {"n": 0}

    def fake(messages):
        o = outputs[min(calls["n"], len(outputs) - 1)]
        calls["n"] += 1
        if isinstance(o, Exception):
            raise o
        return o

    monkeypatch.setitem(tools._REGISTRY, "generate_sql", fake)
    monkeypatch.setattr(settings, "llm_answer", False)


def test_repair_loop_retries_on_non_sql_response(monkeypatch):
    """A non-SQL reply on repair attempt triggers a retry, never CLARIFY."""
    script(
        monkeypatch,
        [
            # Attempt 1: invalid SQL that fails validation
            {"status": "ok", "sql": "SELECT nonexistent_column FROM orders"},
            # Attempt 2: model tries to evade with clarification (no valid SQL)
            {"status": "clarify", "message": "Could you clarify the column name?"},
            # Attempt 3: model provides valid SQL on retry
            {"status": "ok", "sql": "SELECT COUNT(*) FROM sellers"},
        ],
    )
    res = run_query("How many sellers are there?", role="analyst", retrieval_mode="bm25")
    assert res.status == COMPLETED
    assert res.attempts == 3
    assert len(res.rows) == 1


def test_repair_loop_fails_safely_never_clarify_when_all_retries_lack_sql(monkeypatch):
    """When retries persistently return non-SQL responses, pipeline ends with FAILED, never CLARIFY."""
    script(
        monkeypatch,
        [
            # Attempt 1: invalid SQL
            {"status": "ok", "sql": "SELECT bad_column FROM orders"},
            # Attempt 2: clarification attempt with no SQL
            {"status": "clarify", "message": "Please clarify table."},
            # Attempt 3: another clarification attempt with no SQL
            {"status": "clarify", "message": "Still not clear."},
        ],
    )
    res = run_query("How many sellers are there?", role="analyst", retrieval_mode="bm25")
    assert res.status == FAILED
    assert res.attempts == 3


def test_metric_templates_compilation_and_validation():
    """All 5 defined metrics compile to valid SQL that passes validator for analyst/steward."""
    sem = load_semantic()
    allowed_analyst = allowed_map(sem, "analyst")
    restr_analyst = restricted_names(sem, "analyst")

    metrics = [
        "total revenue",
        "average order value",
        "most used payment type",
        "canceled orders",
        "orders with more than one payment",
    ]

    for m in metrics:
        sql = compile_metric_template(m)
        assert sql is not None, f"Failed to compile metric: {m}"
        # Passes for authorized role
        safe_sql = validate(sql, allowed_analyst, restr_analyst)
        assert "SELECT" in safe_sql

        # Blocked for unauthorized roles (e.g. empty allowed map)
        with pytest.raises(Rejected):
            validate(sql, allowed={}, restricted=frozenset())


def test_metric_template_execution_via_pipeline(monkeypatch):
    """Pipeline compiles metric template when picked by the LLM."""
    script(
        monkeypatch,
        [
            {"status": "ok", "metric": "canceled orders", "source_ids": ["metric:canceled_orders"]},
        ],
    )
    res = run_query("How many orders were canceled?", role="analyst", retrieval_mode="bm25")
    assert res.status == COMPLETED
    assert res.attempts == 1
    assert "canceled" in (res.sql or "").lower()
    assert len(res.rows) == 1


def test_result_shape_check_triggers_retry(monkeypatch):
    """For scalar questions (how many/total/average), returning >1 row triggers retry with shape hint."""
    script(
        monkeypatch,
        [
            # Attempt 1: returns multiple rows for a "How many" question
            {"status": "ok", "sql": "SELECT order_id FROM orders LIMIT 5"},
            # Attempt 2: corrects to a single aggregate row
            {"status": "ok", "sql": "SELECT COUNT(*) FROM orders"},
        ],
    )
    res = run_query("How many orders are there?", role="analyst", retrieval_mode="bm25")
    assert res.status == COMPLETED
    assert res.attempts == 2
    assert len(res.rows) == 1


def test_result_shape_check_allows_grouping_questions(monkeypatch):
    """Questions with grouping signals (e.g. 'for each') returning multiple rows do not trigger retry."""
    script(
        monkeypatch,
        [
            {"status": "ok", "sql": "SELECT order_status, COUNT(*) FROM orders GROUP BY order_status"},
        ],
    )
    res = run_query(
        "How many orders are there for each order status?",
        role="analyst",
        retrieval_mode="bm25",
    )
    assert res.status == COMPLETED
    assert res.attempts == 1
    assert len(res.rows) > 1
