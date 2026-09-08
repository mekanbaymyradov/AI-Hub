from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.chat.models import Chat, Message


async def get_chat(db: AsyncSession, *, chat_id: int, user_id: int) -> Chat | None:
    """Return the chat if this user owns it, so callers cannot read another's."""
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def list_chats(db: AsyncSession, *, user_id: int) -> Sequence[Chat]:
    result = await db.execute(
        select(Chat).where(Chat.user_id == user_id).order_by(Chat.updated_at.desc())
    )
    return result.scalars().all()


async def create_chat(db: AsyncSession, *, user_id: int, name: str) -> Chat:
    chat = Chat(user_id=user_id, name=name)
    db.add(chat)
    await db.flush()
    return chat


async def delete_chat(db: AsyncSession, *, chat: Chat) -> None:
    await db.delete(chat)


async def get_messages(db: AsyncSession, *, chat_id: int) -> Sequence[Message]:
    result = await db.execute(
        select(Message).where(Message.chat_id == chat_id).order_by(Message.id)
    )
    return result.scalars().all()


async def add_message(
    db: AsyncSession, *, chat_id: int, content: dict, model_id: str | None
) -> None:
    db.add(Message(chat_id=chat_id, content=content, model_id=model_id))
