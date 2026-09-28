import sys
from collections.abc import Awaitable, Callable
from time import perf_counter

from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.database import SessionLocal, engine
from src.logging import get_logger, setup_logging

logger = get_logger(__name__)


async def run_job(name: str, job: Callable[[AsyncSession], Awaitable[None]]) -> None:
    """Run one cron job, exiting non-zero if it fails."""
    setup_logging(settings.log_level, settings.environment)
    started = perf_counter()

    try:
        async with SessionLocal() as db:
            await job(db)
    except Exception:
        # Logged, not raised, so production gets one JSON line instead of a raw traceback.
        logger.exception("job_failed", job=name)
        sys.exit(1)
    finally:
        await engine.dispose()

    duration_ms = round((perf_counter() - started) * 1000)
    logger.info("job_done", job=name, duration_ms=duration_ms)
