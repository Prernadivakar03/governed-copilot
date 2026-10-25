from contextlib import asynccontextmanager

import httpx
import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.api import approvals, audit, auth, evals, metrics, queries
from app.config import settings
from app.db import connect
from app.governance.tools import warm_retrieval_index


@asynccontextmanager
async def lifespan(_app: FastAPI):
    warm_retrieval_index()
    yield


app = FastAPI(title="Governed Analytics Copilot", lifespan=lifespan)

app.add_middleware(  # the React dev server (Part 3) runs on 5173
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

for r in (auth.router, queries.router, approvals.router, audit.router, metrics.router, evals.router):
    app.include_router(r)


@app.get("/")
def root() -> dict:
    return {"service": "Governed Analytics Copilot", "docs": "/docs"}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict:
    status = {"database": "ok", "llm": "ok"}
    try:
        with connect() as conn:
            conn.execute("SELECT 1")
    except psycopg.Error:
        status["database"] = "down"
    try:
        httpx.get(f"{settings.ollama_url}/api/tags", timeout=2).raise_for_status()
    except httpx.HTTPError:
        status["llm"] = "down"
    if status["database"] == "down":
        raise HTTPException(503, detail=status)
    return status
