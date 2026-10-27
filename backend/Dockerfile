# Multi-stage Dockerfile for FastAPI Backend
# Pinned Base Image
FROM python:3.12-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY backend/requirements.txt ./requirements.txt

# Install CPU-only PyTorch first to prevent downloading ~5GB of unnecessary CUDA wheels
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch --extra-index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Pre-cache embedding model so container starts fast and offline
ENV HF_HOME=/build/hf_cache \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1 \
    TOKENIZERS_PARALLELISM=false
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5')"

# Final stage
FROM python:3.12-slim-bookworm AS final

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root application user
RUN useradd -u 10001 -m -s /bin/bash appuser

COPY --from=builder /opt/venv /opt/venv
COPY --from=builder --chown=appuser:appuser /build/hf_cache /home/appuser/.cache/huggingface

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH="/app/backend" \
    PYTHONUNBUFFERED=1 \
    HF_HOME="/home/appuser/.cache/huggingface" \
    HF_HUB_DISABLE_SYMLINKS_WARNING=1 \
    TOKENIZERS_PARALLELISM=false

WORKDIR /app

COPY --chown=appuser:appuser backend /app/backend
COPY --chown=appuser:appuser data /app/data

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=3s --retries=5 --start-period=10s \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000"]
