from pydantic import BaseModel, EmailStr, Field, computed_field
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base
from src.mixins import TimestampMixin


class User(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str] = mapped_column(unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(255))


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
    avatar_url: str | None

    @computed_field
    @property
    def avatar_initial(self) -> str:
        return (self.name or self.email)[0].upper()


class UserUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
