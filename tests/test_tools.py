import pytest

from app.governance import tools


def test_unknown_tool_refused():
    with pytest.raises(tools.ToolNotAllowed):
        tools.invoke("drop_table")


def test_registered_but_not_allow_listed_tool_refused(monkeypatch):
    monkeypatch.setitem(tools._REGISTRY, "shell", lambda: "pwned")
    with pytest.raises(tools.ToolNotAllowed):
        tools.invoke("shell")


def test_every_allowed_tool_is_implemented():
    for name in tools.ALLOWED_TOOLS:
        assert name in tools._REGISTRY