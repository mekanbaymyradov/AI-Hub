from typing import Annotated

from fastapi import APIRouter, Cookie, Response, status

from src.auth import flows
from src.auth.config import auth_settings
from src.auth.dependencies import CurrentUser
from src.auth.exceptions import InvalidRefreshToken
from src.auth.schemas import (
    OTPRequest,
    OTPVerify,
    RefreshRequest,
    TokenPair,
    UserPublic,
    UserUpdate,
)
from src.config import settings
from src.database import DbSession
from src.redis import RedisDep

REFRESH_COOKIE = "refresh_token"
COOKIE_PATH = "/auth"

auth_router = APIRouter(prefix="/auth", tags=["Auth"])

RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def token_response(
    response: Response, access_token: str, refresh_token: str
) -> TokenPair:
    """Set the refresh cookie and return the pair in the body.

    Web clients read the cookie and ignore the body's refresh token; native clients
    do the opposite. One code path serves both, with no client detection.
    """
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=auth_settings.refresh_token_ttl,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        path=COOKIE_PATH,
    )
    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=auth_settings.access_token_ttl,
    )


@auth_router.post(
    "/otp/request",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Email a sign-in code",
    description="Always accepted, whether or not the address is registered.",
)
async def request_otp(payload: OTPRequest, redis: RedisDep) -> None:
    """Send a one-time code to this address."""
    await flows.request_otp(redis, email=payload.email)


@auth_router.post(
    "/otp/verify",
    summary="Exchange a code for tokens",
    description="Registers the user if this is their first sign-in.",
    responses={
        401: {"description": "Invalid or expired code"},
        429: {"description": "Too many attempts"},
    },
)
async def verify_otp(
    payload: OTPVerify, db: DbSession, redis: RedisDep, response: Response
) -> TokenPair:
    """Sign in with a one-time code."""
    access_token, refresh_token = await flows.verify_otp(
        db, redis, email=payload.email, code=payload.code
    )
    return token_response(response, access_token, refresh_token)


@auth_router.post(
    "/token/refresh",
    summary="Rotate the token pair",
    description="Reads the refresh cookie when present, otherwise the request body.",
    responses={401: {"description": "Unknown, malformed or replayed refresh token"}},
)
async def refresh_tokens(
    payload: RefreshRequest,
    redis: RedisDep,
    response: Response,
    refresh_token: RefreshCookie = None,
) -> TokenPair:
    """Issue a new token pair and invalidate the old refresh token."""
    raw_token = refresh_token or payload.refresh_token
    if raw_token is None:
        raise InvalidRefreshToken()

    access_token, new_refresh_token = await flows.refresh(redis, raw_token=raw_token)
    return token_response(response, access_token, new_refresh_token)


@auth_router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Close the current session",
    description=(
        "Revokes the refresh token. Outstanding access tokens keep working until "
        "they expire."
    ),
)
async def logout(
    payload: RefreshRequest,
    redis: RedisDep,
    response: Response,
    refresh_token: RefreshCookie = None,
) -> None:
    """Sign out of this session."""
    raw_token = refresh_token or payload.refresh_token
    if raw_token is not None:
        await flows.logout(redis, raw_token=raw_token)
    response.delete_cookie(REFRESH_COOKIE, path=COOKIE_PATH)


@auth_router.get("/me", summary="Read the signed-in user")
async def read_me(user: CurrentUser) -> UserPublic:
    """Return the current user."""
    return UserPublic.model_validate(user, from_attributes=True)


@auth_router.patch("/me", summary="Update the signed-in user")
async def update_me(
    payload: UserUpdate, db: DbSession, user: CurrentUser
) -> UserPublic:
    """Change the current user's display name."""
    updated = await flows.update_profile(db, user=user, name=payload.name)
    return UserPublic.model_validate(updated, from_attributes=True)
