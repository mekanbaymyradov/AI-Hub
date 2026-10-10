import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import TypedDict

import logfire
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mypy_boto3_s3 import S3Client
from redis.asyncio import Redis

from src.auth.router import auth_router
from src.chat.router import chat_router
from src.config import settings
from src.error_handlers import register_error_handlers
from src.exceptions import RateLimitExceeded, error_responses
from src.llm.config import llm_settings
from src.llm.registry import LLMRegistry, llm_lifespan
from src.llm.router import llm_router
from src.observability import request_attributes_mapper, setup_observability
from src.rate_limit import global_rate_limit
from src.redis import create_redis_client
from src.storage import create_storage_client

setup_observability()


class State(TypedDict):
    """Objects shared by every request for the app's lifetime."""

    registry: LLMRegistry
    redis: Redis
    storage: S3Client


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[State]:
    # app starts here
    logging.getLogger("uvicorn.access").disabled = True
    redis = create_redis_client(str(settings.redis_uri))
    storage = create_storage_client()
    try:
        async with llm_lifespan(llm_settings) as registry:
            # app runs here
            yield {"registry": registry, "redis": redis, "storage": storage}
    finally:
        await redis.aclose()
        storage.close()
    # app stops here


app = FastAPI(
    title=settings.project_title,
    version=settings.app_version,
    docs_url="/docs" if settings.environment == "local" else None,
    openapi_url="/openapi.json" if settings.environment == "local" else None,
    redoc_url="/redocs" if settings.environment == "local" else None,
    lifespan=lifespan,
    dependencies=[Depends(global_rate_limit)],
    responses=error_responses(RateLimitExceeded),
)

logfire.instrument_fastapi(
    app, excluded_urls="/healthz", request_attributes_mapper=request_attributes_mapper
)

# Added last, so it wraps everything and error responses get CORS headers too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,  # the refresh token travels as a cookie
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["Retry-After"],  # not readable cross-origin otherwise
)

register_error_handlers(app)


@app.get("/healthz", include_in_schema=False)
async def healthz() -> dict:
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(llm_router)
app.include_router(chat_router)
