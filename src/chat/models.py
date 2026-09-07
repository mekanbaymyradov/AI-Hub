# from __future__ import annotations

# from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column  # relationship

from src.database import Base
from src.mixins import TimestampMixin

# if TYPE_CHECKING:
#     from src.auth.models import User


class Chat(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[int] = mapped_column(ForeignKey("user.id", ondelete="cascade"))

    # relationships
    # user: Mapped[User] = relationship(back_populates="chats")


# Pydantic Models