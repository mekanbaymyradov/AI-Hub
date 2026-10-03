from collections.abc import AsyncGenerator, Iterator

import boto3
import pytest
from asgi_lifespan import LifespanManager
from httpx2 import ASGITransport, AsyncClient
from moto import mock_aws
from mypy_boto3_s3 import S3Client
from starlette.config import environ

environ["POSTGRES_HOST"] = "localhost"
environ["POSTGRES_USER"] = "postgres"
environ["POSTGRES_PASSWORD"] = "postgres"
environ["POSTGRES_DB"] = "ai-hub-test"

environ["REDIS_HOST"] = "localhost"
environ["REDIS_INDEX"] = "15"

# PyJWT warns on HMAC keys shorter than 32 bytes.
environ["JWT_SECRET"] = "test-secret-at-least-32-bytes-long"

# Backstop: if the outbox patch ever misses, Resend rejects the call instead of sending.
environ["RESEND_API_KEY"] = "test"
environ["EMAIL_FROM"] = "test@example.com"
environ["LOGFIRE_SEND_TO_LOGFIRE"] = "false"

# Backstop: if the storage override ever misses, uploads fail instead of reaching R2.
environ["S3_ENDPOINT_URL"] = "http://localhost:1"
environ["S3_ACCESS_KEY_ID"] = "test"
environ["S3_SECRET_ACCESS_KEY"] = "test"
environ["S3_PUBLIC_BUCKET"] = "test-public"
environ["S3_PRIVATE_BUCKET"] = "test-private"
environ["S3_PUBLIC_BASE_URL"] = "https://cdn.test"

environ["ANTHROPIC_API_KEY"] = "test"
environ["OPENAI_API_KEY"] = "test"
environ["GOOGLE_API_KEY"] = "test"
environ["GROQ_API_KEY"] = "test"

# Pytest only explains failed asserts in test modules; this covers the helpers too.
# Registered before anything imports tests.utils, or the rewrite is skipped.
pytest.register_assert_rewrite("tests.utils")

from pydantic_ai import models
from pydantic_ai.models.test import TestModel
from redis.asyncio import Redis
from sqlalchemy import make_url, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from src.auth import otp, service, sessions
from src.auth.models import User
from src.config import settings
from src.database import get_db
from src.llm.dependencies import get_llm_registry
from src.llm.enums import Provider
from src.llm.models import ModelSpec
from src.llm.registry import LLMRegistry
from src.main import app
from src.models import Base
from src.redis import create_redis_client, get_redis
from src.storage import get_storage
from tests.utils import REPLY

# Backstop: if a real model ever slips past the fakes, its request fails before
# leaving the machine.
models.ALLOW_MODEL_REQUESTS = False


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(scope="session")
async def db_engine() -> AsyncGenerator[AsyncEngine]:
    assert settings.postgres_db.endswith("test"), settings.postgres_db

    url = make_url(str(settings.database_uri))
    # CREATE DATABASE can't run inside a transaction.
    admin = create_async_engine(
        url.set(database="postgres"), isolation_level="AUTOCOMMIT"
    )
    async with admin.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": url.database},
        )
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{url.database}"'))
    await admin.dispose()

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
    """An in-memory S3 with the public and private buckets created."""
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket=settings.s3_public_bucket)
        s3.create_bucket(Bucket=settings.s3_private_bucket, ACL="private")
        yield s3


@pytest.fixture
def llm_registry() -> LLMRegistry:
    """A registry of fake models, so no test reaches a real provider."""
    specs = [
        ModelSpec(
            provider=Provider.GROQ, model_name="test-model", display_name="Test Model"
        ),
        ModelSpec(
            provider=Provider.GROQ,
            model_name="text-only-model",
            display_name="Text Only Model",
            supports_files=False,
        ),
    ]
    return LLMRegistry(
        models={s.id: TestModel(custom_output_text=REPLY) for s in specs},
        specs={s.id: s for s in specs},
    )


@pytest.fixture(autouse=True)
def sent_codes(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """Sign-in codes the app tried to email, keyed by address."""
    codes: dict[str, str] = {}

    async def fake_send_otp_email(email, code, **kwargs):
        codes[email] = code

    monkeypatch.setattr(otp, "send_otp_email", fake_send_otp_email)
    return codes


@pytest.fixture
async def user(db_session: AsyncSession) -> User:
    return await service.create_user(db_session, email="user@example.com")


@pytest.fixture
async def other_user(db_session: AsyncSession) -> User:
    return await service.create_user(db_session, email="other@example.com")


@pytest.fixture
async def token(redis_client: Redis, user: User) -> str:
    """An access token for `user`, from a real session but without signing in."""
    access_token, _ = await sessions.create_session(redis_client, user_id=user.id)
    return access_token


@pytest.fixture
async def client(
    db_session: AsyncSession,
    redis_client: Redis,
    s3: S3Client,
    llm_registry: LLMRegistry,
) -> AsyncGenerator[AsyncClient]:
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_redis] = lambda: redis_client
    app.dependency_overrides[get_storage] = lambda: s3
    app.dependency_overrides[get_llm_registry] = lambda: llm_registry

    async with (
        LifespanManager(app) as manager,
        AsyncClient(transport=ASGITransport(manager.app), base_url="http://test") as ac,
    ):
        yield ac

    app.dependency_overrides.clear()
