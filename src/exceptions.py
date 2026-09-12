from collections.abc import Sequence


class AppError(Exception):
    """Base error carrying the status, type and message of the response."""

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


class NotFoundError(AppError):
    status = 404
    type = "not_found"
    msg = "Not Found."


class UnauthorizedError(AppError):
    status = 401
    type = "unauthorized"
    msg = "Not authenticated."
    

class RateLimitExceeded(AppError):
    status = 429
    type = "rate_limit"
    msg = "Too many requests."

    def __init__(self, retry_after: int):
        super().__init__()
        self.headers = {"Retry-After": str(retry_after)}