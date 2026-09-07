from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User


async def get_user(db: AsyncSession, *, user_id: int) -> User | None:
    return await db.get(User, user_id)


async def get_user_by_email(db: AsyncSession, *, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, *, email: str) -> User:
    user = User(email=email)
    db.add(user)
    await db.flush()
    return user


async def update_user(db: AsyncSession, *, user: User, name: str) -> User:
    user.name = name
    await db.flush()
    return user


async def update_avatar(
    db: AsyncSession, *, user: User, avatar_key: str | None
) -> User:
    user.avatar_key = avatar_key
    await db.flush()
    return user
