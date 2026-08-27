from collections.abc import Sequence

class AppError(Exception):
    status = 500
    type = "internal_error"
    msg = "An unexpected error occurred."

    def __init__(
        self,
        msg: str | None = None,
        loc: Sequence[str | int] | None = None,
    ):
        self.msg = msg or self.msg
        self.loc = list(loc) if loc else None
        super().__init__(self.msg)

    def serialize(self) -> dict:
        d = {"msg": self.msg, "type": self.type}
        if self.loc:
            d["loc"] = self.loc
        return d


class NotFoundError(AppError):
    status = 404
    type = "not_found"
    msg = "Not Found."