from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse

from src.auth.dependencies import CurrentUser
from src.auth.exceptions import NotAuthenticated
from src.chat import flows
from src.chat.adapter import ChatAdapter
from src.chat.config import chat_settings
from src.chat.constants import NEW_CHAT_NAME, VERCEL_AI_SDK_VERSION
from src.chat.dependencies import ChatDep, ChatIdsDep
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
from src.http_client import HttpClientDep
from src.llm.agents import agent
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


@chat_router.post(
    path="",
    status_code=status.HTTP_201_CREATED,
    response_model=ChatPublic,
    summary="Start a chat",
    description=(
        f"Named `{NEW_CHAT_NAME}` until its first reply is titled. Send its "
        "messages to POST /chats/{chat_id}/messages."
    ),
    responses=error_responses(NotAuthenticated),
    dependencies=[Depends(user_rate_limit(times=20, seconds=60))],
)
async def create_chat(db: DbSession, user: CurrentUser):
    return await flows.create_chat(db, user_id=user.id)


@chat_router.delete(
    path="",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete chats",
    description="Their attachments are deleted from storage once the response is sent.",
    responses=error_responses(NotAuthenticated, ChatNotFound),
)
async def delete_chats(
    chat_ids: ChatIdsDep,
    db: DbSession,
    storage: StorageDep,
    background_tasks: BackgroundTasks,
) -> None:
    keys = await flows.delete_chats(db, chat_ids=chat_ids)
    if keys:
        background_tasks.add_task(flows.delete_attachment_objects, storage, keys=keys)


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
        "returned ids as `attachmentIds` to POST /chats/{chat_id}/messages; each "
        "id can be used once."
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
    path="/{chat_id}/messages",
    response_class=StreamingResponse,
    summary="Send a message and stream the reply",
    description=(
        "Streams the reply in the Vercel AI SDK's UI message stream protocol, "
        "for `useChat`. Send only the new message; the server keeps the history.\n\n"
        "Beyond the protocol's standard chunks:\n\n"
        '- `data-chat-name` (transient): `{"name": <title>}`, after the first '
        f"completed reply, if the chat is still named `{NEW_CHAT_NAME}`.\n"
        "- `error`: its `errorText` is an `ErrorResponse` body as JSON "
        "(`llm.model_error` or `internal_error`), sent if the reply fails after "
        "streaming starts. The status is already 200 by then.\n\n"
        "Errors raised before streaming starts are the JSON responses below."
    ),
    response_description="The reply, as a UI message stream.",
    responses={
        200: {"content": {"text/event-stream": {}}},
        **error_responses(
            NotAuthenticated,
            ChatNotFound,
            ModelNotFound,
            AttachmentNotFound,
            ModelCannotAcceptFiles,
        ),
    },
    dependencies=[Depends(user_rate_limit(times=20, seconds=60))],
)
async def send_message(
    message: MessageRequest,
    chat: ChatDep,
    user: CurrentUser,
    db: DbSession,
    storage: StorageDep,
    registry: LLMRegistryDep,
    http: HttpClientDep,
    request: Request,
) -> StreamingResponse:
    adapter = ChatAdapter(
        agent=agent,
        run_input=message,
        accept=request.headers.get("accept"),
        sdk_version=VERCEL_AI_SDK_VERSION,
        model_id=message.model_id,
    )
    events = await flows.send_message(
        db,
        storage,
        registry,
        http,
        adapter=adapter,
        user=user,
        chat=chat,
        message=message,
    )
    return adapter.streaming_response(events)


@chat_router.patch(
    path="/{chat_id}/rename",
    response_model=ChatPublic,
    summary="Rename a chat",
    responses=error_responses(NotAuthenticated, ChatNotFound),
)
async def rename_chat(payload: ChatRename, chat: ChatDep, db: DbSession):
    return await flows.rename_chat(db, chat=chat, name=payload.name)
