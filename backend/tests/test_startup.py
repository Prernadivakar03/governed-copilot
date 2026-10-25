import importlib

import pytest


@pytest.mark.anyio
async def test_lifespan_warms_retrieval(monkeypatch):
    main = importlib.import_module("app.main")
    called = []
    monkeypatch.setattr(main, "warm_retrieval_index", lambda: called.append(True))

    async with main.lifespan(main.app):
        assert called == [True]

