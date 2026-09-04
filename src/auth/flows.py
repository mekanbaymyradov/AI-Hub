"""Business operations spanning Postgres, Redis and email. Flows own the transaction."""

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import otp, service, sessions
from src.auth.models import User
from src.logging import get_logger

logger = get_logger(__name__)


async def request_otp(redis: Redis, *, email: str) -> None:
    """Issue a code and email it.

    Delivery is awaited rather than backgrounded: a sign-in code cannot be safely
    lost. A provider failure is logged and swallowed so the response stays identical
    whether or not the address exists.
    """
    code = await otp.issue_otp(redis, email=email)
    try:
        await otp.send_otp_email(email, code)
    except Exception:
        logger.exception("otp_delivery_failed", email=email)


async def verify_otp(
    db: AsyncSession, redis: Redis, *, email: str, code: str
) -> tuple[str, str]:
    """Consume a code, registering the user on first sign-in, and open a session."""
    await otp.verify_otp(redis, email=email, code=code)

    user = await service.get_user_by_email(db, email=email)
    if user is None:
        user = await service.create_user(db, email=email)

    access_token, refresh_token = await sessions.create_session(redis, user_id=user.id)
    await db.commit()

    return access_token, refresh_token


async def refresh(redis: Redis, *, raw_token: str) -> tuple[str, str]:
    """Exchange a refresh token for a new pair."""
    return await sessions.rotate_session(redis, raw_token=raw_token)


async def logout(redis: Redis, *, raw_token: str) -> None:
    """Close the session behind this refresh token."""
    await sessions.revoke_session(redis, raw_token=raw_token)


async def update_profile(db: AsyncSession, *, user: User, name: str) -> User:
    """Rename a user."""
    user = await service.update_user(db, user=user, name=name)
    await db.commit()
    return user
