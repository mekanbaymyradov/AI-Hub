"""Raw database operations on users. Callers own the transaction; nothing here commits."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User

NAME_MAX_LENGTH = 50


def derive_name(email: str) -> str:
    """Build a starting display name from an email local-part.

    Args:
        email: The address the user signed up with
    """
    return email.partition("@")[0][:NAME_MAX_LENGTH]


async def get_user(db: AsyncSession, *, user_id: int) -> User | None:
    """Return the user with this id, or None."""
    return await db.get(User, user_id)


async def get_user_by_email(db: AsyncSession, *, email: str) -> User | None:
    """Return the user registered with this address, or None."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, *, email: str) -> User:
    """Add a user for this address, naming them after the email local-part."""
    user = User(email=email, name=derive_name(email))
    db.add(user)
    await db.flush()
    return user


async def update_user(db: AsyncSession, *, user: User, name: str) -> User:
    """Change a user's display name."""
    user.name = name
    await db.flush()
    return user
