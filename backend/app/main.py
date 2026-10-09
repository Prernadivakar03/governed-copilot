from dataclasses import asdict
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.pipeline import run_query

app = FastAPI(title="Governed Analytics Copilot")


class QueryIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    # DEV STUB: in Part 2 the role comes from the JWT, never from the request body
    role: Literal["analyst", "steward"] = "analyst"


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/queries")
def create_query(body: QueryIn) -> dict:
    return asdict(run_query(body.question, body.role))