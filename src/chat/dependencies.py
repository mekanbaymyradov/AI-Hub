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
    spec = llm_registry.spec(message.model_id)
    if spec is None:
        raise ModelNotFound(loc=["body", "model_id"])
    return spec

ModelSpecDep = Annotated[ModelSpec, Depends(get_model_spec)]


async def get_model(spec: ModelSpecDep, llm_registry: LLMRegistryDep) -> Model:
    return llm_registry.model(spec)


async def resolve_chat(
    message: MessageRequest, db: DbSession, user: CurrentUser
) -> Chat | None:
    if message.chat_id is None:
        return None

    chat = await service.get_chat(db, chat_id=message.chat_id, user_id=user.id)
    if chat is None:
        raise ChatNotFound(loc=["body", "chat_id"])
    return chat


async def get_chat(chat_id: int, db: DbSession, user: CurrentUser) -> Chat:
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
