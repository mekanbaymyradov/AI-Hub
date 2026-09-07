from uuid import uuid4

from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from mypy_boto3_s3 import S3Client
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import otp, service, sessions
from src.auth.config import auth_settings
from src.auth.exceptions import AvatarTooLarge, UnsupportedImageType
from src.auth.models import User
from src.config import settings
from src.logging import get_logger

logger = get_logger(__name__)

AVATAR_CONTENT_TYPE = "image/webp"


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


async def set_avatar(
    db: AsyncSession, storage: S3Client, *, user: User, file: UploadFile
) -> tuple[User, str | None]:
    """Validate and store an avatar, returning the user and the replaced key."""
    if file.content_type != AVATAR_CONTENT_TYPE:
        raise UnsupportedImageType()

    if file.size is not None and file.size > auth_settings.avatar_max_bytes:
        raise AvatarTooLarge()

    key = f"avatars/{user.id}/{uuid4().hex}.webp"

    await run_in_threadpool(
        storage.put_object,
        Bucket=settings.s3_bucket,
        Key=key,
        Body=file.file,
        ContentType=AVATAR_CONTENT_TYPE,
        CacheControl="public, max-age=31536000, immutable",
    )

    old_key = user.avatar_key
    user = await service.update_avatar(db, user=user, avatar_key=key)
    await db.commit()

    return user, old_key


async def remove_avatar(db: AsyncSession, *, user: User) -> str | None:
    old_key = user.avatar_key
    await service.update_avatar(db, user=user, avatar_key=None)
    await db.commit()
    return old_key


async def delete_avatar_object(storage: S3Client, *, key: str) -> None:
    """Drop a replaced avatar. Best effort — a leaked object costs nothing."""
    try:
        await run_in_threadpool(
            storage.delete_object, Bucket=settings.s3_bucket, Key=key
        )
    except Exception:
        logger.exception("avatar_delete_failed", key=key)
