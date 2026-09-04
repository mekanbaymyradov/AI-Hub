from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import TypedDict

import logfire
from fastapi import FastAPI
from redis.asyncio import Redis

from src.auth.router import auth_router
from src.config import settings
from src.error_handlers import register_error_handlers
from src.llm.config import llm_settings
from src.llm.registry import LLMRegistry, llm_lifespan
from src.llm.router import llm_router
from src.logging import setup_logging
from src.middleware import AccessLogMiddleware
from src.redis import create_redis_client

setup_logging(settings.log_level, settings.environment)


class State(TypedDict):
    """Objects shared by every request for the app's lifetime."""

    registry: LLMRegistry
    redis: Redis


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[State]:
    """Build the LLM registry and Redis client on startup, release them on shutdown."""
    # app starts here
    redis = create_redis_client(str(settings.redis_uri))
    try:
        async with llm_lifespan(llm_settings) as registry:
            yield {"registry": registry, "redis": redis}  # app runs here
    finally:
        await redis.aclose()
    # app stops here


app = FastAPI(
    title=settings.project_title,
    version=settings.app_version,
    docs_url="/docs" if settings.environment == "local" else None,
    openapi_url="/openapi.json" if settings.environment == "local" else None,
    redoc_url="/redocs" if settings.environment == "local" else None,
    lifespan=lifespan,
)

logfire.configure()
logfire.instrument_fastapi(app)

app.add_middleware(AccessLogMiddleware)

register_error_handlers(app)


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict:
    """Report that the app is up."""
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(llm_router)
