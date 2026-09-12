from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.auth import service, sessions
from src.auth.exceptions import NotAuthenticated
from src.auth.models import User
from src.database import DbSession

bearer_scheme = HTTPBearer(auto_error=False)

BearerToken = Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]


async def get_current_user(db: DbSession, credentials: BearerToken) -> User:
    if credentials is None:
        raise NotAuthenticated()

    claims = sessions.decode_access_token(credentials.credentials)
    user = await service.get_user(db, user_id=int(claims["sub"]))
    if user is None:
        raise NotAuthenticated()

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
