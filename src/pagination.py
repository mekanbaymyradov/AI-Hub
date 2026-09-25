from base64 import urlsafe_b64decode, urlsafe_b64encode
from typing import Annotated, Self

from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field

from src.exceptions import InvalidCursor


class PageParams(BaseModel):
    """The ?limit=&cursor= query parameters of a paginated list."""

    limit: int = Field(20, ge=1, le=100)
    cursor: str | None = Field(
        None,
        description="next_cursor from the previous page; omit for the first page.",
    )


PageParamsDep = Annotated[PageParams, Query()]


class Page[T](BaseModel):
    """One page of a list. next_cursor is null when there are no more items."""

    items: list[T]
    next_cursor: str | None


class Cursor(BaseModel):
    """A bookmark to the last item of a page. Subclasses declare its fields.

    Sent to clients as base64 JSON, so it is URL-safe and opaque to them.
    Unknown fields are rejected, so one list's cursor is refused by another.
    """

    model_config = ConfigDict(extra="forbid")

    def encode(self) -> str:
        return urlsafe_b64encode(self.model_dump_json().encode()).decode()

    @classmethod
    def decode(cls, value: str) -> Self:
        try:
            return cls.model_validate_json(urlsafe_b64decode(value))
        except ValueError:  # bad base64, bad JSON, or missing/wrong fields
            raise InvalidCursor(loc=["query", "cursor"]) from None
