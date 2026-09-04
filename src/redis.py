from typing import Annotated

from fastapi import Depends, Request
from redis.asyncio import Redis


def create_redis_client(uri: str) -> Redis:
    """Create the Redis client shared by every request.

    Args:
        uri: Redis connection string
    """
    return Redis.from_url(uri, decode_responses=True)


async def get_redis(request: Request) -> Redis:
    """Return the client built during the app's lifespan."""
    return request.state.redis


RedisDep = Annotated[Redis, Depends(get_redis)]
