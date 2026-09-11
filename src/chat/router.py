from collections.abc import AsyncIterable
from typing import Annotated

from fastapi import APIRouter, File, UploadFile, status
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
from src.llm.agents import agent
from src.storage import StorageDep

chat_router = APIRouter(prefix="/chats", tags=["Chat"])


@chat_router.get(
    path="",
    summary="List the current user's chats",
    description="Most recently active first.",
    response_model=list[ChatPublic],
)
async def list_chats(db: DbSession, user: CurrentUser):
    return await flows.list_chats(db, user_id=user.id)


@chat_router.delete(
    path="/{chat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a chat",
    responses={404: {"description": "No such chat"}},
)
async def delete_chat(chat: ChatDep, db: DbSession) -> None:
    await flows.delete_chat(db, chat=chat)


@chat_router.get(
    path="/{chat_id}/messages",
    summary="Read a chat's messages",
    responses={404: {"description": "No such chat"}},
)
async def list_messages(
    chat: ChatDep, db: DbSession, storage: StorageDep
) -> list[MessagePublic]:
    return await flows.get_messages(db, storage, chat_id=chat.id)


@chat_router.post(
    path="/attachments",
    status_code=status.HTTP_201_CREATED,
    summary="Upload attachments for a message",
    description=(
        "Upload before sending, then pass the returned ids as `attachment_ids`. "
        "The URLs are signed and expire; read them again from the chat's messages."
    ),
    responses={
        413: {"description": "A file exceeds the size limit"},
        415: {"description": "A file is neither an image nor a PDF"},
        422: {"description": "Too many files"},
    },
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
    summary="Stream a model reply",
    description=(
        "Send `chat_id: null` to open a new chat. The first event is a `chat` "
        "event carrying the id the reply belongs to; the rest are text deltas."
    ),
    responses={
        404: {"description": "No such chat, model or attachment"},
        422: {"description": "The model does not accept attachments"},
    },
)
async def send_message(
    message: MessageRequest,
    model: ModelDep,
    chat: MessageChatDep,
    attachments: Attachments,
    user: CurrentUser,
    db: DbSession,
    storage: StorageDep,
) -> AsyncIterable[ServerSentEvent]:
    if chat is None:
        chat = await flows.create_chat(db, user_id=user.id, prompt=message.prompt)
        history = []
    else:
        history = await flows.get_history(db, storage, chat_id=chat.id)

    yield ServerSentEvent(data={"chat_id": chat.id}, event="chat")

    user_prompt = [message.prompt, *flows.attachment_parts(attachments, storage)]

    async with agent.run_stream(
        model=model, message_history=history, user_prompt=user_prompt
    ) as result:
        async for text in result.stream_text(delta=True):
            yield ServerSentEvent(data=text)

        # Only reached when the stream ran to completion.
        await flows.create_message(
            db,
            chat_id=chat.id,
            messages=result.new_messages(),
            model_id=message.model_id,
            prompt=message.prompt,
            attachments=attachments,
        )


@chat_router.patch(
    path="/{chat_id}/rename",
    summary="Rename the chat name",
    responses={404: {"description": "No such chat"}},
    response_model=ChatPublic
)
async def rename_chat(
    payload: ChatRename, chat: ChatDep, db: DbSession
):
    return await flows.rename_chat(db, chat=chat, name=payload.name)
