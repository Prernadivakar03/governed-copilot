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


import os

# Prevent slow Hugging Face online head checks and telemetry timeouts (saves ~35s)
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")


@lru_cache
def _model():
    try:
        from sentence_transformers import SentenceTransformer

        # Prefer local cache to eliminate slow online Hugging Face checks/timeouts
        try:
            return SentenceTransformer(MODEL_NAME, local_files_only=True)
        except (OSError, ValueError, RuntimeError):
            # If not yet downloaded locally, attempt normal fetch
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


@lru_cache(maxsize=2048)
def _cached_embed_query(norm_text: str) -> tuple[float, ...]:
    v = _model().encode([QUERY_PREFIX + norm_text], normalize_embeddings=True,
                        show_progress_bar=False)
    return tuple(float(x) for x in v[0])


def embed_query(question: str) -> np.ndarray:
    norm_text = question.strip().lower()
    return np.asarray(_cached_embed_query(norm_text), dtype=np.float32)