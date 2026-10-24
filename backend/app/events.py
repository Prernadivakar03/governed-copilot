"""In-memory pipeline events, so the UI can watch a query run. Lost on restart (by design)."""
import threading
from collections import OrderedDict

_LOCK = threading.Lock()
_STORE: "OrderedDict[str, dict]" = OrderedDict()
MAX_QUERIES = 200


def open_query(qid: str) -> None:
    with _LOCK:
        _STORE[qid] = {"events": [], "done": False}
        while len(_STORE) > MAX_QUERIES:
            _STORE.popitem(last=False)


def publish(qid: str, event: dict) -> None:
    with _LOCK:
        slot = _STORE.get(qid)
        if slot is not None:
            slot["events"].append(event)


def finish(qid: str) -> None:
    with _LOCK:
        slot = _STORE.get(qid)
        if slot is not None:
            slot["done"] = True


def snapshot(qid: str, start: int) -> tuple[list[dict], bool]:
    with _LOCK:
        slot = _STORE.get(qid)
        if slot is None:
            return [], True
        return slot["events"][start:], slot["done"]