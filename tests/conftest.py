from collections.abc import AsyncGenerator, Iterator

import boto3
import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient
from moto import mock_aws
from mypy_boto3_s3 import S3Client
from starlette.config import environ

environ["POSTGRES_USER"] = "postgres"
environ["POSTGRES_PASSWORD"] = "postgres"
environ["POSTGRES_DB"] = "ai-hub-test"

environ["REDIS_PASSWORD"] = "redis"
environ["REDIS_INDEX"] = "15"

# Backstop: if the outbox patch ever misses, Resend rejects the call instead of sending.
environ["RESEND_API_KEY"] = "test"
environ["LOGFIRE_SEND_TO_LOGFIRE"] = "false"

# Backstop: if the storage override ever misses, uploads fail instead of reaching R2.
environ["S3_ENDPOINT_URL"] = "http://localhost:1"
environ["S3_ACCESS_KEY_ID"] = "test"
environ["S3_SECRET_ACCESS_KEY"] = "test"
environ["S3_PUBLIC_BUCKET"] = "test-public"
environ["S3_PUBLIC_BASE_URL"] = "https://cdn.test"

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from src.config import settings
from src.database import get_db
from src.main import app
from src.models import Base
from src.redis import create_redis_client, get_redis
from src.storage import get_storage


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
async def db_engine() -> AsyncGenerator[AsyncEngine]:
    # drop_all below would wipe whatever database this points at.
    assert settings.postgres_db.endswith("test"), settings.postgres_db

    engine = create_async_engine(str(settings.database_uri), poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest.fixture
async def db_session(db_engine: AsyncEngine) -> AsyncGenerator[AsyncSession]:
    conn = await db_engine.connect()
    trans = await conn.begin()

    test_async_session = async_sessionmaker(
        bind=conn,
        class_=AsyncSession,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )

    async with test_async_session() as session:
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()
            await conn.close()


@pytest.fixture
async def redis_client() -> AsyncGenerator[Redis]:
    redis = create_redis_client(str(settings.redis_uri))
    await redis.flushdb()

    yield redis

    await redis.aclose()


@pytest.fixture
def s3() -> Iterator[S3Client]:
    """An in-memory S3 with the public bucket created."""
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=settings.s3_public_bucket)
        yield s3


@pytest.fixture
async def client(
    db_session: AsyncSession, redis_client: Redis, s3: S3Client
) -> AsyncGenerator[AsyncClient]:
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_redis] = lambda: redis_client
    app.dependency_overrides[get_storage] = lambda: s3

    async with (
        LifespanManager(app) as manager,
        AsyncClient(transport=ASGITransport(manager.app), base_url="http://test") as ac,
    ):
        yield ac

    app.dependency_overrides.clear()
