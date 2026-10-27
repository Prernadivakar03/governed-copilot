"""Tool allow-list. The pipeline can only call these six tools, by name. summarize was added for answer writing."""
import logging
from collections.abc import Callable
from functools import lru_cache
from typing import Any

from app.config import settings
from app.generation.llm import OllamaClient
from app.generation.prompt import build_answer_messages
from app.retrieval.retriever import Context, Retriever
from app.sandbox.executor import ExecResult, execute, explain_cost
from app.semantic.loader import allowed_map, load_semantic, restricted_names
from app.validation.sql_validator import validate

MAX_ROWS = 1000
ALLOWED_TOOLS = ("retrieve", "generate_sql", "validate_sql", "execute_readonly", "explain", "summarize")
_REGISTRY: dict[str, Callable[..., Any]] = {}
log = logging.getLogger(__name__)


class ToolNotAllowed(Exception):
    pass


def tool(name: str):
    def deco(fn):
        _REGISTRY[name] = fn
        return fn

    return deco


def invoke(name: str, **kwargs: Any) -> Any:
    """Being registered is not enough: the name must also be on the allow-list."""
    if name not in ALLOWED_TOOLS or name not in _REGISTRY:
        raise ToolNotAllowed(f"tool not allowed: {name}")
    return _REGISTRY[name](**kwargs)


@lru_cache
def _retriever(role: str, mode: str) -> Retriever:
    return Retriever(load_semantic(), role, mode=mode)


def warm_retrieval_index() -> None:
    """Build the configured retrieval indexes and warm model before the first user query."""
    for role in ("analyst", "steward"):
        try:
            r = _retriever(role, settings.retrieval_mode)
            if settings.retrieval_mode in ("vector", "hybrid"):
                r.search("warmup test query", k=2)
        except Exception:
            # Retrieval remains available through the normal fallback path if
            # the embedding model cannot be loaded during startup.
            log.exception("Could not warm the %s retrieval index", role)


def _llm() -> OllamaClient:
    return OllamaClient(seed=settings.llm_seed, temperature=settings.llm_temperature)


@tool("retrieve")
def _retrieve(question: str, role: str, mode: str) -> Context:
    return _retriever(role, mode).context(question)


@tool("generate_sql")
def _generate_sql(messages: list[dict]) -> dict:
    return _llm().chat_json(messages)


@tool("validate_sql")
def _validate_sql(sql: str, role: str) -> str:
    sem = load_semantic()
    return validate(sql, allowed_map(sem, role), restricted_names(sem, role), MAX_ROWS)


@tool("execute_readonly")
def _execute_readonly(sql: str, role: str, max_rows: int = MAX_ROWS) -> ExecResult:
    return execute(sql, role, max_rows)


@tool("explain")
def _explain(sql: str, role: str) -> float:
    return explain_cost(sql, role)


@tool("summarize")
def _summarize(question: str, columns: list[str], rows: list[list], truncated: bool) -> dict:
    return _llm().chat_json(build_answer_messages(question, columns, rows, truncated))
