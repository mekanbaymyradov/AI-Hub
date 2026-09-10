from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.chat.config import chat_settings
from src.database import Base
from src.mixins import TimestampMixin

if TYPE_CHECKING:
    from src.auth.models import User


class Chat(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[int] = mapped_column(
        ForeignKey("user.id", ondelete="cascade"), index=True
    )

    # relationships
    user: Mapped[User] = relationship(back_populates="chats")
    messages: Mapped[list[Message]] = relationship(
        back_populates="chat",
        cascade="all, delete-orphan",
        order_by="Message.id",
        passive_deletes=True,
    )


class Message(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[int] = mapped_column(
        ForeignKey("chat.id", ondelete="cascade"), index=True
    )
    content: Mapped[dict] = mapped_column(JSONB)
    model_id: Mapped[str | None] = mapped_column(String(100))

    # relationships
    chat: Mapped[Chat] = relationship(back_populates="messages")
    attachments: Mapped[list[Attachment]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
        order_by="Attachment.id",
        passive_deletes=True,
    )


class Attachment(Base, TimestampMixin):
    """A file uploaded for a message, held in the private attachments bucket.

    A row is created when the file is uploaded and only gains its message once
    the prompt it belongs to is sent, so message_id is nullable and the owner
    is tracked separately.
    """

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("user.id", ondelete="cascade"), index=True
    )
    message_id: Mapped[int | None] = mapped_column(
        ForeignKey("message.id", ondelete="cascade"), index=True
    )
    key: Mapped[str] = mapped_column(String(255))
    filename: Mapped[str] = mapped_column(String(255))
    media_type: Mapped[str] = mapped_column(String(100))

    # relationships
    message: Mapped[Message | None] = relationship(back_populates="attachments")


# Pydantic Models
class MessageRequest(BaseModel):
    """A prompt sent to a model, in an existing chat or a new one."""

    chat_id: int | None = None
    model_id: str
    prompt: str = Field(min_length=1)
    attachment_ids: list[int] = Field(
        default_factory=list, max_length=chat_settings.attachment_max_count
    )


class ChatPublic(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime


class AttachmentPublic(BaseModel):
    """An uploaded file, with a URL the client can read it from for a while."""

    id: int
    filename: str
    media_type: str
    url: str


class MessagePublic(BaseModel):
    id: int
    kind: Literal["request", "response"]
    content: str
    model_id: str | None
    created_at: datetime
    attachments: list[AttachmentPublic] = []
