from typing import Annotated

from fastapi import Cookie, Response

from src.auth.config import auth_settings
from src.config import settings

REFRESH_COOKIE = "refresh_token"
COOKIE_PATH = "/auth"  # must match auth_router's prefix

RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=auth_settings.refresh_token_ttl,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        path=COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)
