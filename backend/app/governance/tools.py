"""Tool allow-list. The pipeline can only call these five tools, by name."""
from collections.abc import Callable
from functools import lru_cache
from typing import Any

from app.generation.llm import OllamaClient
from app.retrieval.retriever import Context, Retriever
from app.sandbox.executor import ExecResult, execute, explain_cost
from app.semantic.loader import allowed_map, load_semantic, restricted_names
from app.validation.sql_validator import validate

MAX_ROWS = 1000
ALLOWED_TOOLS = ("retrieve", "generate_sql", "validate_sql", "execute_readonly", "explain")
_REGISTRY: dict[str, Callable[..., Any]] = {}


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


@lru_cache
def _llm() -> OllamaClient:
    return OllamaClient()


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