from pydantic import BaseModel, EmailStr, Field, computed_field
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.mixins import TimestampMixin
from src.storage import public_url


class User(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(unique=True)
    avatar_key: Mapped[str | None] = mapped_column(String(255))

    # relationships
    # chats: Mapped[list[Chat]] = relationship("Chat", back_populates="user")


# Pydantic Models
class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerify(BaseModel):
    email: EmailStr
    code: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserPublic(BaseModel):
    id: int
    email: str
    name: str | None
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
    name: str = Field(min_length=1, max_length=50)
