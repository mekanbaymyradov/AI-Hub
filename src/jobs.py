from collections.abc import Awaitable, Callable

import logfire
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import SessionLocal, engine
from src.observability import setup_observability


async def run_job(name: str, job: Callable[[AsyncSession], Awaitable[None]]) -> None:
    """Run one cron job, exiting non-zero if it fails."""
    setup_observability()

    # No except: the span records a failure for Logfire, and the uncaught
    # traceback is what reaches docker logs, since the console never prints spans.
    try:
        with logfire.span("Job run", job=name):
            async with SessionLocal() as db:
                await job(db)
    finally:
        await engine.dispose()
