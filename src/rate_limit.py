"""Rate limiting backed by the app's Redis client."""

from collections.abc import Awaitable, Callable

from fastapi import Request
from fastapi.security import HTTPAuthorizationCredentials
from redis.asyncio import Redis
from redis.exceptions import RedisError

from src.auth.dependencies import CurrentUser, bearer_scheme
from src.auth.exceptions import NotAuthenticated
from src.auth.sessions import decode_access_token
from src.config import settings
from src.exceptions import RateLimitExceeded
from src.logging import get_logger
from src.redis import RedisDep

logger = get_logger(__name__)


async def _check(redis: Redis, *, key: str, times: int, seconds: int) -> None:
    """Count this request against the window, or fail open if Redis is down."""
    try:
        async with redis.pipeline() as pipe:
            pipe.incr(key)
            pipe.expire(key, seconds, nx=True)
            pipe.ttl(key)
            count, _, ttl = await pipe.execute()
    except RedisError:
        logger.warning("rate_limit_unavailable", key=key)
        return

    if count > times:
        raise RateLimitExceeded(retry_after=ttl)


def _identity(
    request: Request, credentials: HTTPAuthorizationCredentials | None
) -> tuple[str, int]:
    """The bucket this request counts against, and its ceiling."""
    if credentials is not None:
        try:
            claims = decode_access_token(credentials.credentials)
        except NotAuthenticated:
            pass
        else:
            return f"user:{claims['sub']}", settings.rate_limit_user_limit
    host = request.client.host if request.client else "unknown"
    return f"ip:{host}", settings.rate_limit_ip_limit


async def global_rate_limit(request: Request, redis: RedisDep) -> None:
    """App-wide ceiling: per user when signed in, per client IP otherwise."""
    if request.url.path == "/healthz":
        return

    identity, times = _identity(request, await bearer_scheme(request))
    await _check(
        redis,
        key=f"ratelimit:global:{identity}",
        times=times,
        seconds=settings.rate_limit_window_seconds,
    )


def user_rate_limit(times: int, seconds: int) -> Callable[..., Awaitable[None]]:
    """Limit one route by user id, for routes with authenticated user."""

    async def dependency(request: Request, user: CurrentUser, redis: RedisDep) -> None:
        path = request.scope["route"].path
        await _check(
            redis,
            key=f"ratelimit:{path}:{times}p{seconds}:user:{user.id}",
            times=times,
            seconds=seconds,
        )

    return dependency


def ip_rate_limit(times: int, seconds: int) -> Callable[..., Awaitable[None]]:
    """Limit one route by client address, for routes with no authenticated user."""

    async def dependency(request: Request, redis: RedisDep) -> None:
        path = request.scope["route"].path
        host = request.client.host if request.client else "unknown"
        await _check(
            redis,
            key=f"ratelimit:{path}:{times}p{seconds}:ip:{host}",
            times=times,
            seconds=seconds,
        )

    return dependency
