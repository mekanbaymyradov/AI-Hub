from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, EmailStr, Field, computed_field, field_validator
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.auth.constants import INSTRUCTIONS_MAX_LENGTH
from src.database import Base
from src.mixins import TimestampMixin
from src.storage import public_url

if TYPE_CHECKING:
    from src.chat.models import Chat


class User(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(unique=True)
    avatar_key: Mapped[str | None] = mapped_column(String(255))
    # Text, since the length limit lives in UserUpdate and may change.
    instructions: Mapped[str | None] = mapped_column(Text)

    # relationships
    chats: Mapped[list[Chat]] = relationship(
        "Chat",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


# Pydantic Models
class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerify(BaseModel):
    email: EmailStr
    code: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Seconds until the access token expires.")


class UserPublic(BaseModel):
    id: int
    email: str
    name: str | None
    instructions: str | None
    # Read from the ORM object but never serialized; avatar_url is what clients get.
    avatar_key: str | None = Field(exclude=True)

    @computed_field
    @property
    def avatar_url(self) -> str | None:
        return public_url(self.avatar_key) if self.avatar_key else None

    @computed_field
    @property
    def avatar_initial(self) -> str:
        return (self.name or self.email)[0].upper()


class UserUpdate(BaseModel):
    """A partial update: omitted fields are left alone, null clears a field."""

    name: str | None = Field(default=None, min_length=1, max_length=50)
    instructions: str | None = Field(default=None, max_length=INSTRUCTIONS_MAX_LENGTH)

    @field_validator("instructions")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        return (value.strip() or None) if value else None
