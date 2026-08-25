from fastapi import FastAPI
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import TypedDict
import logfire

from src.config import settings
from src.llm.config import llm_settings
from src.llm.registry import LLMRegistry, llm_lifespan
from src.llm.router import llm_router
from src.logging import setup_logging
from src.middleware import AccessLogMiddleware


setup_logging(settings.log_level, settings.environment)

class State(TypedDict):
    registry: LLMRegistry


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[State]:
    # app starts here
    async with llm_lifespan(llm_settings) as registry:
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

logfire.configure()
logfire.instrument_fastapi(app)

app.add_middleware(AccessLogMiddleware)

@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict:
    return {"status": "ok"}

app.include_router(llm_router)