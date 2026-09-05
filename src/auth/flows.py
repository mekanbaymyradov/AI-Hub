from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import otp, service, sessions
from src.auth.models import User
from src.logging import get_logger

logger = get_logger(__name__)


async def request_otp(db: AsyncSession, redis: Redis, *, email: str) -> None:
    # Picks the template only; the response is identical either way, so whether
    # the address is registered never reaches the caller.
    user = await service.get_user_by_email(db, email=email)
    code = await otp.issue_otp(redis, email=email)
    try:
        await otp.send_otp_email(
            email, code, name=user.name if user else None, is_new_user=user is None
        )
    except Exception:
        logger.exception("otp_delivery_failed", email=email)


async def verify_otp(
    db: AsyncSession, redis: Redis, *, email: str, code: str
) -> tuple[str, str]:
    await otp.verify_otp(redis, email=email, code=code)

    user = await service.get_user_by_email(db, email=email)
    if user is None:
        user = await service.create_user(db, email=email)

    access_token, refresh_token = await sessions.create_session(redis, user_id=user.id)
    await db.commit()

    return access_token, refresh_token


async def refresh(redis: Redis, *, raw_token: str) -> tuple[str, str]:
    return await sessions.rotate_session(redis, raw_token=raw_token)


async def logout(redis: Redis, *, raw_token: str) -> None:
    await sessions.revoke_session(redis, raw_token=raw_token)


async def update_profile(db: AsyncSession, *, user: User, name: str) -> User:
    user = await service.update_user(db, user=user, name=name)
    await db.commit()
    return user
