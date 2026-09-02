from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from src.config import settings


def create_db_engine(connection_str: str) -> AsyncEngine:
    """Create a database engine with proper timeout settings.

    Args:
        connection_str: Database connection string
    """
    url = make_url(connection_str)

    db_kwargs = {
        # Connection timeout - how long to wait for a connection from the pool
        "pool_timeout": settings.database_engine_pool_timeout,
        # Recycle connections after this many seconds
        "pool_recycle": settings.database_engine_pool_recycle,
        # Maximum number of connections to keep in the pool
        "pool_size": settings.database_engine_pool_size,
        # Maximum overflow connections allowed beyond pool_size
        "max_overflow": settings.database_engine_max_overflow,
        # Connection pre-ping to verify connection is still alive
        "pool_pre_ping": settings.database_engine_pool_ping,
        # if True, the Engine will log all statements, defaults to sys.stdout for output
        "echo": settings.database_engine_echo
    }
    return create_async_engine(url, **db_kwargs)

engine = create_db_engine(str(settings.sqlalchemy_database_uri))


SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession]:
    """
    Get database session.
    """
    async with SessionLocal() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]