from collections.abc import AsyncIterable
from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.sse import EventSourceResponse, ServerSentEvent

from src.auth.dependencies import CurrentUser
from src.auth.exceptions import NotAuthenticated
from src.chat import flows
from src.chat.config import chat_settings
from src.chat.dependencies import Attachments, ChatDep, MessageChatDep, ModelDep
from src.chat.exceptions import (
    AttachmentNotFound,
    AttachmentTooLarge,
    ChatNotFound,
    ModelCannotAcceptFiles,
    TooManyAttachments,
    UnsupportedAttachmentType,
)
from src.chat.models import (
    AttachmentPublic,
    ChatPublic,
    ChatRename,
    MessagePublic,
    MessageRequest,
)
from src.database import DbSession
from src.exceptions import error_responses
from src.llm.dependencies import LLMRegistryDep
from src.llm.exceptions import ModelNotFound
from src.pagination import Page, PageParamsDep
from src.rate_limit import user_rate_limit
from src.storage import StorageDep

chat_router = APIRouter(prefix="/chats", tags=["Chat"])


@chat_router.get(
    path="",
    summary="List the current user's chats",
    description="Most recently active first.",
    responses=error_responses(NotAuthenticated),
)
async def list_chats(
    db: DbSession, user: CurrentUser, params: PageParamsDep
) -> Page[ChatPublic]:
    return await flows.list_chats(db, user_id=user.id, params=params)


@chat_router.delete(
    path="/{chat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a chat",
    responses=error_responses(NotAuthenticated, ChatNotFound),
)
async def delete_chat(chat: ChatDep, db: DbSession) -> None:
    await flows.delete_chat(db, chat=chat)


@chat_router.get(
    path="/{chat_id}/messages",
    summary="List a chat's messages",
    description=(
        "The first page holds the newest messages, and each page reads oldest "
        "first. Messages with no text, like tool calls, are left out."
    ),
    responses=error_responses(NotAuthenticated, ChatNotFound),
)
async def list_messages(
    chat: ChatDep, db: DbSession, storage: StorageDep, params: PageParamsDep
) -> Page[MessagePublic]:
    return await flows.get_messages(db, storage, chat_id=chat.id, params=params)


@chat_router.post(
    path="/attachments",
    status_code=status.HTTP_201_CREATED,
    summary="Upload files for a later message",
    description=(
        f"Images and PDFs, at most {chat_settings.attachment_max_count} files of "
        f"{chat_settings.attachment_max_bytes // 1_048_576} MiB each. Send the "
        "returned ids as `attachment_ids` to POST /chats/messages; each id can be "
        "used once."
    ),
    responses=error_responses(
        NotAuthenticated,
        AttachmentTooLarge,
        UnsupportedAttachmentType,
        TooManyAttachments,
    ),
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
    summary="Send a message and stream the reply",
    description=(
        "Streams the reply as Server-Sent Events:\n\n"
        '1. `chat`: `{"id": <chat id>}`, sent first, for new and existing chats.\n'
        "2. Unnamed events whose data is a JSON string with the next piece of the "
        "reply. The stream ends when the reply is complete.\n"
        "3. `error`: an `ErrorResponse` body (`llm.model_error` or `internal_error`) "
        "if the reply fails after streaming starts. The status is already 200 by "
        "then.\n\n"
        "Errors raised before streaming starts are the JSON responses below."
    ),
    responses=error_responses(
        NotAuthenticated,
        ChatNotFound,
        ModelNotFound,
        AttachmentNotFound,
        ModelCannotAcceptFiles,
    ),
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
        user=user,
        chat=chat,
        message=message,
        model=model,
        attachments=attachments,
    ):
        yield event


@chat_router.patch(
    path="/{chat_id}/rename",
    response_model=ChatPublic,
    summary="Rename a chat",
    responses=error_responses(NotAuthenticated, ChatNotFound),
)
async def rename_chat(payload: ChatRename, chat: ChatDep, db: DbSession):
    return await flows.rename_chat(db, chat=chat, name=payload.name)
