from collections.abc import Sequence
from typing import Any, cast

from sqlalchemy import CursorResult, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.chat.models import Attachment, Chat, Message


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
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.id)
        .options(selectinload(Message.attachments))
    )
    return result.scalars().all()


async def create_message(
    db: AsyncSession, *, chat_id: int, content: dict, model_id: str | None
) -> Message:
    message = Message(chat_id=chat_id, content=content, model_id=model_id)
    db.add(message)
    await db.flush()
    return message


async def create_attachment(
    db: AsyncSession, *, user_id: int, key: str, filename: str, media_type: str
) -> Attachment:
    attachment = Attachment(
        user_id=user_id, key=key, filename=filename, media_type=media_type
    )
    db.add(attachment)
    await db.flush()
    return attachment


async def get_attachments(
    db: AsyncSession, *, attachment_ids: Sequence[int], user_id: int
) -> Sequence[Attachment]:
    """Return this user's attachments that are not spoken for by a message yet.

    Ordered by id to match the order the message relationship replays them in, so
    a prompt's files read the same live as they do in the chat's history.
    """
    result = await db.execute(
        select(Attachment)
        .where(
            Attachment.id.in_(attachment_ids),
            Attachment.user_id == user_id,
            Attachment.message_id.is_(None),
        )
        .order_by(Attachment.id)
    )
    return result.scalars().all()


async def attach_to_message(
    db: AsyncSession, *, attachment_ids: Sequence[int], message_id: int
) -> int:
    """Claim unclaimed attachments for a message, returning how many were claimed."""
    result = await db.execute(
        update(Attachment)
        .where(Attachment.id.in_(attachment_ids), Attachment.message_id.is_(None))
        .values(message_id=message_id)
    )
    return cast(CursorResult[Any], result).rowcount


async def rename_chat(db: AsyncSession, *, chat: Chat, name: str) -> Chat:
    chat.name = name
    await db.flush()
    return chat
