from collections.abc import Sequence
from typing import Annotated

from fastapi import Depends
from pydantic_ai.models import Model

from src.auth.dependencies import CurrentUser
from src.chat import service
from src.chat.exceptions import (
    AttachmentNotFound,
    ChatNotFound,
    ModelCannotAcceptFiles,
)
from src.chat.models import Attachment, Chat, MessageRequest
from src.database import DbSession
from src.llm.dependencies import LLMRegistryDep
from src.llm.exceptions import ModelNotFound
from src.llm.models import ModelSpec


async def get_model_spec(
    message: MessageRequest, llm_registry: LLMRegistryDep
) -> ModelSpec:
    """Resolve the body's model id to a spec, or raise ModelNotFound.

    The only place the model id is checked, so what the endpoint is handed cannot
    depend on the order its dependencies happen to resolve in.

    The parameter must keep the same name as the endpoint's body parameter, or
    FastAPI treats the two as separate fields and nests both under a wrapper object.
    """
    spec = llm_registry.spec(message.model_id)
    if spec is None:
        raise ModelNotFound(loc=["body", "model_id"])
    return spec


# Defined here, not with the aliases below, because the dependencies that follow
# take it as a parameter.
ModelSpecDep = Annotated[ModelSpec, Depends(get_model_spec)]


async def get_model(spec: ModelSpecDep, llm_registry: LLMRegistryDep) -> Model:
    """Return the model the body asked for."""
    return llm_registry.model(spec)


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


async def resolve_attachments(
    message: MessageRequest,
    db: DbSession,
    user: CurrentUser,
    spec: ModelSpecDep,
) -> Sequence[Attachment]:
    """Return the attachments named in the body, or raise before the reply starts.

    Once the stream is open no status code can be returned, so an unusable
    attachment or a model that cannot read one has to fail here.

    The parameter naming caveat on get_model applies here too.
    """
    if not message.attachment_ids:
        return []

    if not spec.supports_files:
        raise ModelCannotAcceptFiles(loc=["body", "attachment_ids"])

    attachments = await service.get_attachments(
        db, attachment_ids=message.attachment_ids, user_id=user.id
    )
    if len(attachments) != len(set(message.attachment_ids)):
        raise AttachmentNotFound(loc=["body", "attachment_ids"])

    return attachments


ModelDep = Annotated[Model, Depends(get_model)]
MessageChatDep = Annotated[Chat | None, Depends(resolve_chat)]
ChatDep = Annotated[Chat, Depends(get_chat)]
Attachments = Annotated[Sequence[Attachment], Depends(resolve_attachments)]
