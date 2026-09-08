from pydantic_ai.messages import (
    ModelMessage,
    ModelMessagesTypeAdapter,
    ModelRequest,
    TextPart,
    UserPromptPart,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.chat import service
from src.chat.models import Chat, ChatPublic, Message, MessagePublic

CHAT_NAME_LENGTH = 60


async def start_chat(db: AsyncSession, *, user_id: int, prompt: str) -> Chat:
    """Open a chat named after the prompt that started it."""
    chat = await service.create_chat(
        db, user_id=user_id, name=prompt[:CHAT_NAME_LENGTH]
    )
    await db.commit()
    return chat


async def delete_chat(db: AsyncSession, *, chat: Chat) -> None:
    await service.delete_chat(db, chat=chat)
    await db.commit()


async def list_chats(db: AsyncSession, *, user_id: int) -> list[ChatPublic]:
    chats = await service.list_chats(db, user_id=user_id)
    return [ChatPublic.model_validate(chat, from_attributes=True) for chat in chats]


async def get_history(db: AsyncSession, *, chat_id: int) -> list[ModelMessage]:
    """Return the chat so far, in the form an agent run takes as its history."""
    rows = await service.get_messages(db, chat_id=chat_id)
    return ModelMessagesTypeAdapter.validate_python([row.content for row in rows])


async def record_turn(
    db: AsyncSession, *, chat_id: int, messages: list[ModelMessage], model_id: str
) -> None:
    """Store the messages a single run produced, one row each.

    Only the reply records the model, so a chat continued with a different one
    stays accurate about which model said what.
    """
    for content in ModelMessagesTypeAdapter.dump_python(messages, mode="json"):
        is_reply = content["kind"] == "response"
        await service.add_message(
            db,
            chat_id=chat_id,
            content=content,
            model_id=model_id if is_reply else None,
        )
    await db.commit()


def message_text(message: ModelMessage) -> str:
    """Join the parts of a message that a client can display."""
    displayed = UserPromptPart if isinstance(message, ModelRequest) else TextPart
    return "".join(
        part.content
        for part in message.parts
        if isinstance(part, displayed) and isinstance(part.content, str)
    )


def to_public(row: Message, message: ModelMessage) -> MessagePublic:
    """Flatten a stored message into the shape clients render."""
    return MessagePublic(
        id=row.id,
        role="user" if isinstance(message, ModelRequest) else "assistant",
        text=message_text(message),
        model_id=row.model_id,
        created_at=row.created_at,
    )


async def list_messages(db: AsyncSession, *, chat_id: int) -> list[MessagePublic]:
    """Return the chat's messages, leaving out those with nothing to display."""
    rows = await service.get_messages(db, chat_id=chat_id)
    messages = ModelMessagesTypeAdapter.validate_python([row.content for row in rows])
    public = [
        to_public(row, message) for row, message in zip(rows, messages, strict=True)
    ]
    return [message for message in public if message.text]
