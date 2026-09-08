from typing import Annotated

from fastapi import Depends
from pydantic_ai.models import Model

from src.auth.dependencies import CurrentUser
from src.chat import service
from src.chat.exceptions import ChatNotFound
from src.chat.models import Chat, MessageRequest
from src.database import DbSession
from src.llm.dependencies import LLMRegistryDep
from src.llm.exceptions import ModelNotFound


async def get_model(message: MessageRequest, llm_registry: LLMRegistryDep) -> Model:
    """Resolve the body's model id to a model, or raise ModelNotFound.

    The parameter must keep the same name as the endpoint's body parameter, or
    FastAPI treats the two as separate fields and nests both under a wrapper object.
    """
    model = llm_registry.model(message.model_id)
    if model is None:
        raise ModelNotFound(loc=["body", "model_id"])
    return model


async def resolve_chat(
    message: MessageRequest, db: DbSession, user: CurrentUser
) -> Chat | None:
    """Return the chat named in the body, or None when it asks for a new one.

    Resolving here keeps an unknown chat_id a 404 raised before the reply starts
    streaming; opening the new chat is the endpoint's job.

    The parameter naming caveat on get_model applies here too.
    """
    if message.chat_id is None:
        return None

    chat = await service.get_chat(db, chat_id=message.chat_id, user_id=user.id)
    if chat is None:
        raise ChatNotFound(loc=["body", "chat_id"])
    return chat


async def get_chat(chat_id: int, db: DbSession, user: CurrentUser) -> Chat:
    """Return the chat named in the path, or raise ChatNotFound."""
    chat = await service.get_chat(db, chat_id=chat_id, user_id=user.id)
    if chat is None:
        raise ChatNotFound(loc=["path", "chat_id"])
    return chat


ModelDep = Annotated[Model, Depends(get_model)]
MessageChatDep = Annotated[Chat | None, Depends(resolve_chat)]
ChatDep = Annotated[Chat, Depends(get_chat)]
