"""Rate limiting backed by the app's Redis client."""

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from redis.asyncio import Redis
from redis.exceptions import RedisError

from src.auth.dependencies import CurrentUser
from src.exceptions import RateLimitExceeded
from src.logging import get_logger
from src.redis import RedisDep

logger = get_logger(__name__)


async def _check(
    redis: Redis,
    response: Response,
    *,
    path: str,
    identity: str,
    times: int,
    seconds: int,
) -> None:
    """Count this request against the window, or fail open if Redis is down."""
    key = f"ratelimit:{path}:{times}p{seconds}:{identity}"
    try:
        async with redis.pipeline() as pipe:
            pipe.incr(key)
            pipe.ttl(key)
            count, ttl = await pipe.execute()
        if ttl < 0:
            await redis.expire(key, seconds)
            ttl = seconds
    except RedisError:
        logger.warning("rate_limit_unavailable", key=key)
        return

    if count > times:
        raise RateLimitExceeded(retry_after=ttl)

    response.headers["X-RateLimit-Limit"] = str(times)
    response.headers["X-RateLimit-Remaining"] = str(times - count)
    response.headers["X-RateLimit-Reset"] = str(ttl)


def user_rate_limit(times: int, seconds: int) -> Callable[..., Awaitable[None]]:
    """Limit by user id."""

    async def dependency(
        request: Request, response: Response, user: CurrentUser, redis: RedisDep
    ) -> None:
        await _check(
            redis,
            response,
            path=request.scope["route"].path,
            identity=f"user:{user.id}",
            times=times,
            seconds=seconds,
        )

    return dependency


def ip_rate_limit(times: int, seconds: int) -> Callable[..., Awaitable[None]]:
    """Limit by client address, for routes with no authenticated user."""

    async def dependency(request: Request, response: Response, redis: RedisDep) -> None:
        host = request.client.host if request.client else "unknown"
        await _check(
            redis,
            response,
            path=request.scope["route"].path,
            identity=f"ip:{host}",
            times=times,
            seconds=seconds,
        )

    return dependency
