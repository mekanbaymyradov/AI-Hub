from collections.abc import AsyncIterable

from fastapi import APIRouter, status
from fastapi.sse import EventSourceResponse, ServerSentEvent

from src.auth.dependencies import CurrentUser
from src.chat import flows
from src.chat.dependencies import ChatDep, MessageChatDep, ModelDep
from src.chat.models import ChatPublic, MessagePublic, MessageRequest
from src.database import DbSession
from src.llm.agents import agent

chat_router = APIRouter(prefix="/chats", tags=["Chat"])


@chat_router.get(
    path="",
    summary="List the current user's chats",
    description="Most recently active first.",
)
async def list_chats(db: DbSession, user: CurrentUser) -> list[ChatPublic]:
    return await flows.list_chats(db, user_id=user.id)


@chat_router.get(
    path="/{chat_id}/messages",
    summary="Read a chat's messages",
    description="Oldest first. Messages with nothing to display are left out.",
    responses={404: {"description": "No such chat"}},
)
async def get_messages(chat: ChatDep, db: DbSession) -> list[MessagePublic]:
    return await flows.list_messages(db, chat_id=chat.id)


@chat_router.delete(
    path="/{chat_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a chat",
    description="Its messages go with it.",
    responses={404: {"description": "No such chat"}},
)
async def delete_chat(chat: ChatDep, db: DbSession) -> None:
    await flows.delete_chat(db, chat=chat)


@chat_router.post(
    path="/messages",
    response_class=EventSourceResponse,
    summary="Stream a model reply",
    description=(
        "Send `chat_id: null` to open a new chat. The first event is a `chat` "
        "event carrying the id the reply belongs to; the rest are text deltas."
    ),
    responses={404: {"description": "No such chat or model"}},
)
async def send_message(
    message: MessageRequest,
    model: ModelDep,
    chat: MessageChatDep,
    user: CurrentUser,
    db: DbSession,
) -> AsyncIterable[ServerSentEvent]:
    """Stream the model's reply to the prompt, then store the exchange."""
    if chat is None:
        chat = await flows.start_chat(db, user_id=user.id, prompt=message.prompt)
        history = []
    else:
        history = await flows.get_history(db, chat_id=chat.id)

    yield ServerSentEvent(data={"chat_id": chat.id}, event="chat")

    async with agent.run_stream(
        model=model, message_history=history, user_prompt=message.prompt
    ) as result:
        async for text in result.stream_text(delta=True):
            yield ServerSentEvent(raw_data=text)

        # Only reached when the stream ran to completion. An abandoned reply is
        # left unsaved, so a chat never holds a prompt without its answer.
        await flows.record_turn(
            db,
            chat_id=chat.id,
            messages=result.new_messages(),
            model_id=message.model_id,
        )
