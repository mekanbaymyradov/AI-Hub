from collections.abc import AsyncIterable
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.sse import EventSourceResponse, ServerSentEvent

from src.auth.dependencies import CurrentUser
from src.chat import flows
from src.chat.dependencies import Attachments, ChatDep, MessageChatDep, ModelDep
from src.chat.models import (
    AttachmentPublic,
    ChatPublic,
    ChatRename,
    MessagePublic,
    MessageRequest,
)
from src.database import DbSession
from src.llm.dependencies import LLMRegistryDep
from src.pagination import Page, PageParamsDep
from src.rate_limit import user_rate_limit
from src.storage import StorageDep

chat_router = APIRouter(prefix="/chats", tags=["Chat"])


@chat_router.get("")
async def list_chats(
    db: DbSession, user: CurrentUser, params: PageParamsDep
) -> Page[ChatPublic]:
    return await flows.list_chats(db, user_id=user.id, params=params)


@chat_router.delete(
    path="/{chat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_chat(chat: ChatDep, db: DbSession) -> None:
    await flows.delete_chat(db, chat=chat)


@chat_router.get(
    path="/{chat_id}/messages",
)
async def list_messages(
    chat: ChatDep, db: DbSession, storage: StorageDep, params: PageParamsDep
) -> Page[MessagePublic]:
    return await flows.get_messages(db, storage, chat_id=chat.id, params=params)


@chat_router.post(
    path="/attachments",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(user_rate_limit(times=30, seconds=60))],
)
async def create_attachments(
    db: DbSession,
    storage: StorageDep,
    user: CurrentUser,
    files: Annotated[list[UploadFile], File()],
) -> list[AttachmentPublic]:
    attachments = await flows.create_attachments(
        db, storage, user_id=user.id, files=files
    )
    return [flows.attachment_public(a, storage) for a in attachments]


@chat_router.post(
    path="/messages",
    response_class=EventSourceResponse,
    dependencies=[Depends(user_rate_limit(times=20, seconds=60))],
)
async def send_message(
    message: MessageRequest,
    model: ModelDep,
    chat: MessageChatDep,
    attachments: Attachments,
    user: CurrentUser,
    db: DbSession,
    storage: StorageDep,
    registry: LLMRegistryDep,
) -> AsyncIterable[ServerSentEvent]:
    async for event in flows.send_message(
        db,
        storage,
        registry,
        user_id=user.id,
        chat=chat,
        message=message,
        model=model,
        attachments=attachments,
    ):
        yield event


@chat_router.patch(
    path="/{chat_id}/rename",
    response_model=ChatPublic,
)
async def rename_chat(payload: ChatRename, chat: ChatDep, db: DbSession):
    return await flows.rename_chat(db, chat=chat, name=payload.name)
