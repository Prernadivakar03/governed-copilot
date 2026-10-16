"""Local embeddings with bge-small. Vectors are cached on disk by content hash."""
import hashlib
from functools import lru_cache

import numpy as np

from app.config import ROOT

MODEL_NAME = "BAAI/bge-small-en-v1.5"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "
CACHE = ROOT / ".cache" / "emb"


class EmbeddingsUnavailable(Exception):
    pass


@lru_cache
def _model():
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(MODEL_NAME)
    except Exception as e:  # missing package, no internet on first download, etc.
        raise EmbeddingsUnavailable(str(e)) from e


def embed_docs(texts: list[str]) -> np.ndarray:
    key = hashlib.sha256((MODEL_NAME + "\n".join(texts)).encode()).hexdigest()
    path = CACHE / f"{key}.npy"
    if path.exists():
        return np.load(path)
    vecs = _model().encode(texts, normalize_embeddings=True, batch_size=32,
                           show_progress_bar=False)
    vecs = np.asarray(vecs, dtype=np.float32)
    CACHE.mkdir(parents=True, exist_ok=True)
    np.save(path, vecs)
    return vecs


def embed_query(question: str) -> np.ndarray:
    v = _model().encode([QUERY_PREFIX + question], normalize_embeddings=True,
                        show_progress_bar=False)
    return np.asarray(v[0], dtype=np.float32)