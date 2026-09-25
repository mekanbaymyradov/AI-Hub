from typing import Annotated

from fastapi import Depends, Request
from redis.asyncio import Redis


def create_redis_client(uri: str) -> Redis:
    """Create the shared Redis client. Replies are decoded to str, not bytes."""
    return Redis.from_url(uri, decode_responses=True)


async def get_redis(request: Request) -> Redis:
    return request.state.redis


RedisDep = Annotated[Redis, Depends(get_redis)]
