from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_ai.ui.vercel_ai.request_types import (
    RegenerateMessage,
    SubmitMessage,
    TextUIPart,
    UIMessage,
)
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.chat.config import chat_settings
from src.database import Base
from src.mixins import TimestampMixin
from src.pagination import Cursor

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

    def __repr__(self):
        return f"Chat(id={self.id}, name={self.name}, user_id={self.user_id})"


class Message(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[int] = mapped_column(
        ForeignKey("chat.id", ondelete="cascade"), index=True
    )
    # One pydantic-ai ModelMessage, as dumped by ModelMessagesTypeAdapter.
    content: Mapped[dict] = mapped_column(JSONB)
    # The model that wrote a response; null on the user's prompts.
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
    key: Mapped[str] = mapped_column(String(255), unique=True)
    filename: Mapped[str] = mapped_column(String(255))
    media_type: Mapped[str] = mapped_column(String(100))

    # relationships
    message: Mapped[Message | None] = relationship(back_populates="attachments")


# Pydantic Models
class MessageRequest(SubmitMessage):
    """A Vercel AI SDK chat request carrying only the message being sent.

    The server keeps the chat's history, so the client sends just the new
    message, as the AI SDK's `prepareSendMessagesRequest` can be set to do.
    """

    # SubmitMessage allows extra fields; a misspelled one should fail, not be dropped.
    model_config = ConfigDict(extra="forbid")

    trigger: Literal["submit-message"] = Field(
        "submit-message",
        description=(
            "Only `submit-message`; send `regenerate-message` to "
            "POST /chats/{chat_id}/retry."
        ),
    )
    id: str = Field(
        description="The `useChat` chat id. Ignored; the path's chat is used."
    )
    messages: list[UIMessage] = Field(
        min_length=1,
        max_length=1,
        description=(
            "One user message with text parts only; send files as `attachmentIds`. "
            "The server keeps the history."
        ),
    )
    model_id: str = Field(description="An id from GET /llms/models.")
    attachment_ids: list[int] = Field(
        default_factory=list,
        max_length=chat_settings.attachment_max_count,
        description="Ids from POST /chats/attachments that no message has used yet.",
    )
    effort: Literal["low", "medium", "high"] | None = Field(
        None,
        description="How hard the model reasons before replying; omit for its default.",
    )

    @field_validator("messages")
    @classmethod
    def check_text_prompt(cls, messages: list[UIMessage]) -> list[UIMessage]:
        message = messages[0]
        texts = [part.text for part in message.parts if isinstance(part, TextUIPart)]
        # Files come as attachment ids instead: a URL from the client cannot be
        # trusted, and a signed one would expire in the stored history.
        if message.role != "user" or len(texts) != len(message.parts):
            raise ValueError("Send one user message with text parts only.")
        if not any(texts):
            raise ValueError("The message has no text.")
        return messages

    @property
    def prompt(self) -> str:
        return "\n".join(
            part.text for part in self.messages[0].parts if isinstance(part, TextUIPart)
        )


class ChatPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_at: datetime
    updated_at: datetime


class AttachmentPublic(BaseModel):
    """An uploaded file, with a URL the client can read it from for a while."""

    id: int
    filename: str
    media_type: str
    url: str = Field(
        description=f"Signed URL, valid for {chat_settings.attachment_url_ttl // 60} "
        "minutes."
    )


class MessagePublic(BaseModel):
    id: int
    kind: Literal["request", "response"] = Field(
        description="request: the user's message; response: the model's reply."
    )
    content: str
    model_id: str | None = Field(
        description="Model that wrote the reply; null on the user's messages."
    )
    created_at: datetime
    attachments: list[AttachmentPublic] = []


class ChatRename(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class RetryRequest(RegenerateMessage):
    # RegenerateMessage allows extra fields; a misspelled one should fail, not be dropped.
    model_config = ConfigDict(extra="forbid")

    trigger: Literal["regenerate-message"] = Field(
        "regenerate-message", description="Only `regenerate-message`."
    )
    id: str = Field(
        description="The `useChat` chat id. Ignored; the path's chat is used."
    )
    messages: list[UIMessage] = Field(
        default_factory=list,
        max_length=0,
        description="Leave empty; the server keeps the history.",
    )
    message_id: str | None = Field(
        None, description="Ignored; the chat's last reply is regenerated."
    )
    model_id: str = Field(description="An id from GET /llms/models.")
    effort: Literal["low", "medium", "high"] | None = Field(
        None,
        description="How hard the model reasons before replying; omit for its default.",
    )


class ChatCursor(Cursor):
    updated_at: datetime
    id: int


class MessageCursor(Cursor):
    id: int
