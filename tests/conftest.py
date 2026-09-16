from collections.abc import AsyncGenerator

import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient
from starlette.config import environ

environ["POSTGRES_USER"] = "postgres"
environ["POSTGRES_PASSWORD"] = "postgres"
environ["POSTGRES_DB"] = "ai-hub-test"

environ["REDIS_PASSWORD"] = "redis"
environ["REDIS_INDEX"] = "15"

# Backstop: if the outbox patch ever misses, Resend rejects the call instead of sending.
environ["RESEND_API_KEY"] = "test"
environ["LOGFIRE_SEND_TO_LOGFIRE"] = "false"

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
async def client(
    db_session: AsyncSession, redis_client: Redis
) -> AsyncGenerator[AsyncClient]:
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_redis] = lambda: redis_client

    async with (
        LifespanManager(app) as manager,
        AsyncClient(transport=ASGITransport(manager.app), base_url="http://test") as ac,
    ):
        yield ac

    app.dependency_overrides.clear()
