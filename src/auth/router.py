from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Response, UploadFile, status

from src.auth import flows
from src.auth.config import auth_settings
from src.auth.cookies import (
    RefreshCookie,
    clear_refresh_cookie,
    set_refresh_cookie,
)
from src.auth.dependencies import CurrentUser
from src.auth.exceptions import InvalidRefreshToken
from src.auth.models import (
    OTPRequest,
    OTPVerify,
    Token,
    UserPublic,
    UserUpdate,
)
from src.database import DbSession
from src.redis import RedisDep
from src.storage import StorageDep

auth_router = APIRouter(prefix="/auth", tags=["Auth"])


@auth_router.post(
    "/otp/request",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Email a sign-in code",
    description="Always accepted, whether or not the address is registered.",
)
async def request_otp(payload: OTPRequest, db: DbSession, redis: RedisDep) -> None:
    await flows.request_otp(db, redis, email=payload.email)


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
) -> Token:
    access_token, refresh_token = await flows.verify_otp(
        db, redis, email=payload.email, code=payload.code
    )
    set_refresh_cookie(response, refresh_token)
    return Token(access_token=access_token, expires_in=auth_settings.access_token_ttl)


@auth_router.post(
    "/token/refresh",
    summary="Rotate the token pair",
    description="Reads the refresh token from the HttpOnly cookie.",
    responses={401: {"description": "Unknown, malformed or replayed refresh token"}},
)
async def refresh_tokens(
    redis: RedisDep,
    response: Response,
    refresh_token: RefreshCookie = None,
) -> Token:
    if refresh_token is None:
        raise InvalidRefreshToken()

    access_token, new_refresh_token = await flows.refresh(
        redis, raw_token=refresh_token
    )
    set_refresh_cookie(response, new_refresh_token)
    return Token(access_token=access_token, expires_in=auth_settings.access_token_ttl)


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
    redis: RedisDep,
    response: Response,
    refresh_token: RefreshCookie = None,
) -> None:
    if refresh_token is not None:
        await flows.logout(redis, raw_token=refresh_token)
    clear_refresh_cookie(response)


@auth_router.get("/me", summary="Read the current user")
async def read_me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user, from_attributes=True)


@auth_router.patch("/me", summary="Update the current user")
async def update_me(
    payload: UserUpdate, db: DbSession, user: CurrentUser
) -> UserPublic:
    updated = await flows.update_profile(db, user=user, name=payload.name)
    return UserPublic.model_validate(updated, from_attributes=True)


@auth_router.put(
    "/me/avatar",
    summary="Replace the current user's avatar",
    description=(
        "Expects a WebP image the client has already resized and compressed. "
        "The previous avatar is deleted once the response is sent."
    ),
    responses={
        413: {"description": "Image exceeds the size limit"},
        415: {"description": "Image is not a WebP"},
    },
)
async def set_avatar(
    db: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File()],
) -> UserPublic:
    updated, old_key = await flows.set_avatar(db, storage, user=user, file=file)
    if old_key and old_key != updated.avatar_key:
        background_tasks.add_task(flows.delete_avatar_object, storage, key=old_key)
    return UserPublic.model_validate(updated, from_attributes=True)


@auth_router.delete(
    "/me/avatar",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove the current user's avatar",
    description="Clients fall back to `avatar_initial` once the avatar is gone.",
)
async def delete_avatar(
    db: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    background_tasks: BackgroundTasks,
) -> None:
    old_key = await flows.remove_avatar(db, user=user)
    if old_key:
        background_tasks.add_task(flows.delete_avatar_object, storage, key=old_key)
