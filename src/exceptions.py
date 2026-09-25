from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel, Field


class AppError(Exception):
    """Base error carrying the status, type and message of the response.

    `loc` points at the input at fault, like ["body", "code"] in FastAPI's own
    validation errors.
    """

    status = 500
    type = "internal_error"
    msg = "An unexpected error occurred."
    headers: dict[str, str] | None = None

    def __init__(
        self,
        msg: str | None = None,
        loc: Sequence[str | int] | None = None,
    ):
        self.msg = msg or self.msg
        self.loc = list(loc) if loc else None
        super().__init__(self.msg)

    def serialize(self) -> dict:
        """Return the error as one detail item."""
        d = {"msg": self.msg, "type": self.type}
        if self.loc:
            d["loc"] = self.loc
        return d


class ErrorDetail(BaseModel):
    loc: list[str | int] | None = Field(
        default=None,
        description='Input at fault, like ["body", "code"]. Omitted when no single '
        "input is at fault.",
    )
    msg: str
    type: str = Field(description="Stable error code. Branch on this, not on `msg`.")


class ErrorResponse(BaseModel):
    detail: list[ErrorDetail]


def error_responses(*errors: type[AppError]) -> dict[int | str, dict[str, Any]]:
    """Return OpenAPI `responses`; errors sharing a status become named examples."""
    by_status: dict[int, list[type[AppError]]] = {}
    for error in errors:
        by_status.setdefault(error.status, []).append(error)

    responses: dict[int | str, dict[str, Any]] = {}
    for status, group in by_status.items():
        if len(group) == 1:
            description = group[0].msg
        else:
            description = "\n".join(f"- `{e.type}`: {e.msg}" for e in group)
        examples = {
            e.type: {
                "summary": e.msg,
                "value": {"detail": [{"msg": e.msg, "type": e.type}]},
            }
            for e in group
        }
        responses[status] = {
            "model": ErrorResponse,
            "description": description,
            "content": {"application/json": {"examples": examples}},
        }
    return responses


class NotFoundError(AppError):
    status = 404
    type = "not_found"
    msg = "Not Found."


class UnauthorizedError(AppError):
    status = 401
    type = "unauthorized"
    msg = "Not authenticated."


class ContentTooLargeError(AppError):
    status = 413
    type = "content_too_large"
    msg = "Content too large."


class UnsupportedMediaTypeError(AppError):
    status = 415
    type = "unsupported_media_type"
    msg = "Unsupported media type."


class RateLimitExceeded(AppError):
    status = 429
    type = "rate_limit"
    msg = "Too many requests."

    def __init__(self, retry_after: int):
        super().__init__()
        self.headers = {"Retry-After": str(retry_after)}


class InvalidCursor(AppError):
    status = 422
    type = "invalid_cursor"
    msg = "Invalid cursor."
