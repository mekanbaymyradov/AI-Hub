from fastapi import FastAPI
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import TypedDict

from src.config import settings

class State(TypedDict):
    pass


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[State]:
    yield {}
    # app stops here

app = FastAPI(
    title=settings.project_title,
    version=settings.app_version,
    docs_url="/docs" if settings.environment == "local" else None,
    openapi_url="/openapi.json" if settings.environment == "local" else None,
    redoc_url="/redocs" if settings.environment == "local" else None,
    lifespan=lifespan
)

@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict:
    return {"status": "ok"} 