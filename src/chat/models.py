from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

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


# Pydantic Models
class MessageRequest(BaseModel):
    """A prompt sent to a model, in an existing chat or a new one."""

    chat_id: int | None = None
    model_id: str
    prompt: str = Field(min_length=1)


class ChatPublic(BaseModel):
    id: int
    name: str
    created_at: datetime
    updated_at: datetime


class MessagePublic(BaseModel):
    id: int
    role: Literal["user", "assistant"]
    text: str
    model_id: str | None
    created_at: datetime
