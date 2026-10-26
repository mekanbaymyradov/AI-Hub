from collections.abc import Sequence
from typing import Annotated

from fastapi import Depends, Query

from src.auth.dependencies import CurrentUser
from src.chat import service
from src.chat.exceptions import ChatNotFound
from src.chat.models import Chat
from src.database import DbSession


async def get_chat(chat_id: int, db: DbSession, user: CurrentUser) -> Chat:
    chat = await service.get_chat(db, chat_id=chat_id, user_id=user.id)
    if chat is None:
        raise ChatNotFound(loc=["path", "chat_id"])
    return chat


async def get_chat_ids(
    chat_ids: Annotated[list[int], Query()], db: DbSession, user: CurrentUser
) -> Sequence[int]:
    owned = await service.get_chat_ids(db, chat_ids=chat_ids, user_id=user.id)
    if len(owned) != len(set(chat_ids)):
        raise ChatNotFound(loc=["query", "chat_ids"])
    return owned


ChatDep = Annotated[Chat, Depends(get_chat)]
ChatIdsDep = Annotated[Sequence[int], Depends(get_chat_ids)]
