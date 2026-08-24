from fastapi import FastAPI
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import TypedDict

from src.config import settings
from src.llm.config import llm_settings
from src.llm.registry import LLMRegistry, build_registry
from src.llm.router import llm_router

class State(TypedDict):
    registry: LLMRegistry


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[State]:
    # app starts here
    registry = build_registry(llm_settings)
    yield {"registry": registry} # app runs here
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

app.include_router(llm_router)