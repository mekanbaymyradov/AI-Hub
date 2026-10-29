from collections.abc import AsyncIterator, Sequence
from typing import cast
from uuid import uuid4

import httpx2
import logfire
from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from mypy_boto3_s3 import S3Client
from pydantic_ai import AgentRunResult
from pydantic_ai.messages import (
    DocumentUrl,
    ImageUrl,
    ModelMessage,
    ModelMessagesTypeAdapter,
    ModelRequest,
    UserContent,
    UserPromptPart,
)
from pydantic_ai.settings import ModelSettings, ThinkingEffort
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, DataChunk
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User
from src.chat import service
from src.chat.adapter import ChatAdapter
from src.chat.config import chat_settings
from src.chat.constants import ALLOWED_MEDIA_TYPES, CHAT_NAME_LENGTH, NEW_CHAT_NAME
from src.chat.exceptions import (
    AttachmentNotFound,
    AttachmentTooLarge,
    ModelCannotAcceptFiles,
    NothingToRetry,
    TooManyAttachments,
    UnsupportedAttachmentType,
)
from src.chat.models import (
    Attachment,
    AttachmentPublic,
    Chat,
    ChatCursor,
    ChatPublic,
    MessageCursor,
    MessagePublic,
    MessageRequest,
    RetryRequest,
)
from src.llm.agents import title_agent
from src.llm.constants import TITLE_MODEL_ID
from src.llm.exceptions import ModelNotFound
from src.llm.models import AgentDeps, ModelSpec
from src.llm.registry import LLMRegistry
from src.pagination import Page, PageParams
from src.storage import presigned_url


async def create_chat(db: AsyncSession, *, user_id: int) -> Chat:
    chat = await service.create_chat(db, user_id=user_id, name=NEW_CHAT_NAME)
    await db.commit()
    return chat


async def create_prompt(
    db: AsyncSession, *, chat: Chat, prompt: str, attachments: Sequence[Attachment]
) -> None:
    """Store the user's prompt ahead of the run, so a failed reply cannot lose it.

    Only the text is stored. The prompt claims the attachments, which have been
    waiting unattached since they were uploaded, and get_history adds them back.
    """
    request = ModelRequest(parts=[UserPromptPart(content=prompt)])
    message = await service.create_message(
        db,
        chat_id=chat.id,
        content=ModelMessagesTypeAdapter.dump_python([request], mode="json")[0],
        model_id=None,
    )

    if attachments:
        claimed = await service.attach_to_message(
            db,
            attachment_ids=[attachment.id for attachment in attachments],
            message_id=message.id,
        )
        if claimed != len(attachments):
            logfire.warn(
                "Attachments already claimed",
                chat_id=chat.id,
                expected=len(attachments),
                claimed=claimed,
            )

    await service.touch_chat(db, chat_id=chat.id)
    await db.commit()


async def generate_chat_name(registry: LLMRegistry, *, prompt: str) -> str | None:
    """Ask a cheap model to title a new chat, or return None if it cannot."""
    spec = registry.spec(TITLE_MODEL_ID)
    if spec is None:
        return None

    try:
        result = await title_agent.run(prompt, model=registry.model(spec))
    except Exception:
        logfire.exception("Chat naming failed")
        return None

    name = result.output
    return name[:CHAT_NAME_LENGTH] or None


async def apply_chat_name(db: AsyncSession, *, chat: Chat, name: str) -> bool:
    """Give a new chat its name unless the user renamed it meanwhile, returning whether it did.

    chat.name still holds the placeholder the chat was created with, since a
    rename arrives through another request's session and this one never reloads
    the chat.
    """
    renamed = await service.rename_chat_if_unchanged(
        db, chat_id=chat.id, old_name=chat.name, new_name=name
    )
    await db.commit()
    return renamed


async def delete_chats(db: AsyncSession, *, chat_ids: Sequence[int]) -> Sequence[str]:
    """Delete the chats, returning the attachment keys the caller should drop from storage."""
    keys = await service.get_attachment_keys(db, chat_ids=chat_ids)
    await service.delete_chats(db, chat_ids=chat_ids)
    await db.commit()
    return keys


async def delete_attachment_objects(storage: S3Client, *, keys: Sequence[str]) -> None:
    """Drop files whose attachment rows are gone. Failures are only logged."""
    try:
        result = await run_in_threadpool(
            storage.delete_objects,
            Bucket=chat_settings.s3_private_bucket,
            Delete={"Objects": [{"Key": key} for key in keys]},
        )
    except Exception:
        logfire.exception("Attachment delete failed", count=len(keys))
        return

    # Individual keys fail in the response body, not as an exception.
    if errors := result.get("Errors"):
        logfire.error("Attachment delete partly failed", errors=errors)


async def list_chats(
    db: AsyncSession, *, user_id: int, params: PageParams
) -> Page[ChatPublic]:
    cursor = ChatCursor.decode(params.cursor) if params.cursor else None

    chats = await service.list_chats(
        db, user_id=user_id, limit=params.limit, cursor=cursor
    )

    next_cursor = None
    if len(chats) == params.limit:
        last = chats[-1]
        next_cursor = ChatCursor(updated_at=last.updated_at, id=last.id).encode()

    items = [ChatPublic.model_validate(chat) for chat in chats]
    return Page[ChatPublic](items=items, next_cursor=next_cursor)


async def create_attachments(
    db: AsyncSession, storage: S3Client, *, user_id: int, files: list[UploadFile]
) -> Sequence[Attachment]:
    """Validate and store files, returning the rows a later message can claim."""
    if len(files) > chat_settings.attachment_max_count:
        raise TooManyAttachments()

    # Every file is checked before any is stored, so a rejected one cannot leave
    # the files ahead of it orphaned in the bucket.
    for index, file in enumerate(files):
        if file.content_type not in ALLOWED_MEDIA_TYPES:
            raise UnsupportedAttachmentType(loc=["body", "files", index])

        if file.size is not None and file.size > chat_settings.attachment_max_bytes:
            raise AttachmentTooLarge(loc=["body", "files", index])

    attachments = []
    for file in files:
        # No extension; the media type is a column, and the bucket is private.
        key = f"attachments/{user_id}/{uuid4().hex}"
        media_type = cast(str, file.content_type)

        await run_in_threadpool(
            storage.put_object,
            Bucket=chat_settings.s3_private_bucket,
            Key=key,
            Body=file.file,
            ContentType=media_type,
        )

        attachments.append(
            await service.create_attachment(
                db,
                user_id=user_id,
                key=key,
                filename=(file.filename or "file")[:255],
                media_type=media_type,
            )
        )

    await db.commit()
    return attachments


def _attachment_url(attachment: Attachment, storage: S3Client) -> str:
    return presigned_url(
        storage,
        bucket=chat_settings.s3_private_bucket,
        key=attachment.key,
        expires_in=chat_settings.attachment_url_ttl,
    )


def attachment_public(attachment: Attachment, storage: S3Client) -> AttachmentPublic:
    return AttachmentPublic(
        id=attachment.id,
        filename=attachment.filename,
        media_type=attachment.media_type,
        url=_attachment_url(attachment, storage),
    )


def _attachment_parts(
    attachments: Sequence[Attachment], storage: S3Client
) -> list[UserContent]:
    """Render attachments as prompt content the model can fetch."""
    parts: list[UserContent] = []
    for attachment in attachments:
        url = _attachment_url(attachment, storage)
        content = (
            ImageUrl if attachment.media_type.startswith("image/") else DocumentUrl
        )
        # Named in a text part of its own, because a `FileUrl`'s own identifier
        # only reaches the model when a tool returns it.
        parts.append(f'File "{attachment.filename}":')
        # A signed URL carries a query string, so Pydantic AI cannot infer the
        # media type from it.
        parts.append(content(url=url, media_type=attachment.media_type))
    return parts


async def _resolve_attachments(
    db: AsyncSession,
    *,
    spec: ModelSpec,
    user_id: int,
    attachment_ids: Sequence[int],
) -> Sequence[Attachment]:
    if not attachment_ids:
        return []

    if not spec.supports_files:
        raise ModelCannotAcceptFiles(loc=["body", "attachmentIds"])

    attachments = await service.get_attachments(
        db, attachment_ids=attachment_ids, user_id=user_id
    )
    if len(attachments) != len(set(attachment_ids)):
        raise AttachmentNotFound(loc=["body", "attachmentIds"])

    return attachments


async def get_history(
    db: AsyncSession, storage: S3Client, *, chat_id: int, through: int | None = None
) -> list[ModelMessage]:
    """Return the chat so far, in the form an agent run takes as its history.

    Attachments are added back from their own rows, with freshly signed URLs,
    since the stored message holds the prompt text alone. The prompt being
    answered is already stored, so the history ends with it, or with message
    `through` if given.
    """
    rows = await service.get_messages(db, chat_id=chat_id, through=through)
    history = ModelMessagesTypeAdapter.validate_python([row.content for row in rows])

    for row, message in zip(rows, history, strict=True):
        if not row.attachments:
            continue

        parts = _attachment_parts(row.attachments, storage)
        for part in message.parts:
            if isinstance(part, UserPromptPart) and isinstance(part.content, str):
                part.content = [part.content, *parts]

    # Released before the reply starts streaming, so the connection is not held
    # idle in a transaction for as long as the model takes to answer.
    await db.commit()
    return history


def _prompt_text(request: ModelRequest) -> str:
    return "".join(
        part.content
        for part in request.parts
        if isinstance(part, UserPromptPart) and isinstance(part.content, str)
    )


async def get_messages(
    db: AsyncSession, storage: S3Client, *, chat_id: int, params: PageParams
) -> Page[MessagePublic]:
    """Return a page of the chat as plain text.

    The first page holds the newest messages; each page reads oldest first.
    """
    cursor = MessageCursor.decode(params.cursor) if params.cursor else None

    rows = await service.list_messages(
        db, chat_id=chat_id, limit=params.limit, cursor=cursor
    )

    next_cursor = None
    if len(rows) == params.limit:
        next_cursor = MessageCursor(id=rows[-1].id).encode()

    rows = rows[::-1]
    messages = ModelMessagesTypeAdapter.validate_python([row.content for row in rows])

    transcript = []
    for row, message in zip(rows, messages, strict=True):
        if isinstance(message, ModelRequest):
            content = _prompt_text(message)
        else:
            content = message.text or ""

        if not content:
            continue

        transcript.append(
            MessagePublic(
                id=row.id,
                kind=message.kind,
                content=content,
                model_id=row.model_id,
                created_at=row.created_at,
                attachments=[
                    attachment_public(attachment, storage)
                    for attachment in row.attachments
                ],
            )
        )
    return Page[MessagePublic](items=transcript, next_cursor=next_cursor)


async def create_reply(
    db: AsyncSession,
    *,
    chat_id: int,
    messages: list[ModelMessage],
    model_id: str,
    replace_after: int | None = None,
) -> None:
    """Store the messages a run produced after its prompt, one row each.

    Only the reply records the model, so a chat continued with a different one
    stays accurate about which model said what. With `replace_after`, the rows
    after that message are deleted first, in the same transaction.
    """
    if replace_after is not None:
        # Deleted only now, so a retry that fails or is cut off keeps the old reply.
        await service.delete_messages_after(
            db, chat_id=chat_id, message_id=replace_after
        )
    for content in ModelMessagesTypeAdapter.dump_python(messages, mode="json"):
        await service.create_message(
            db,
            chat_id=chat_id,
            content=content,
            model_id=model_id if content["kind"] == "response" else None,
        )
    await db.commit()


def _stream_reply(
    db: AsyncSession,
    registry: LLMRegistry,
    http: httpx2.AsyncClient,
    *,
    adapter: ChatAdapter,
    spec: ModelSpec,
    user: User,
    chat: Chat,
    history: list[ModelMessage],
    prompt: str,
    effort: ThinkingEffort | None,
    replace_after: int | None = None,
) -> AsyncIterator[BaseChunk]:
    """Return the reply's stream, which stores the reply once it completes.

    Args:
        history: The chat through the prompt being answered, which it ends with.
        prompt: The prompt's text, to title a chat still named NEW_CHAT_NAME.
        replace_after: Passed to create_reply, to replace the rows after it.
    """

    async def on_complete(result: AgentRunResult[str]) -> AsyncIterator[BaseChunk]:
        await create_reply(
            db,
            chat_id=chat.id,
            messages=result.new_messages(),
            model_id=spec.id,
            replace_after=replace_after,
        )
        if chat.name != NEW_CHAT_NAME:
            return

        name = await generate_chat_name(registry, prompt=prompt)
        name = name or prompt[:CHAT_NAME_LENGTH]
        if await apply_chat_name(db, chat=chat, name=name):
            # Transient: the title belongs to the chat, not to the reply message.
            yield DataChunk(type="data-chat-name", data={"name": name}, transient=True)

    # With no user prompt given, the run resumes from the stored prompt that
    # ends the history, and leaves it out of new_messages().
    return adapter.run_stream(
        model=registry.model(spec),
        message_history=history,
        # The path's chat id, not the client-sent `id`, labels the run's traces.
        conversation_id=str(chat.id),
        deps=AgentDeps(name=user.name, instructions=user.instructions, http=http),
        # `thinking` takes no None, so an omitted effort sends no settings.
        model_settings=ModelSettings(thinking=effort) if effort else None,
        on_complete=on_complete,
    )


async def send_message(
    db: AsyncSession,
    storage: S3Client,
    registry: LLMRegistry,
    http: httpx2.AsyncClient,
    *,
    adapter: ChatAdapter,
    user: User,
    chat: Chat,
    message: MessageRequest,
) -> AsyncIterator[BaseChunk]:
    """Store the prompt, then return the reply's stream, which stores the reply once it completes.

    The prompt is stored before the stream starts, so a failure storing it is an
    ordinary error response, and a reply that fails or is cut off still leaves
    it in the chat. A failure after that ends the stream with an error chunk.
    """
    spec = registry.spec(message.model_id)
    if spec is None:
        raise ModelNotFound(loc=["body", "modelId"])
    attachments = await _resolve_attachments(
        db, spec=spec, user_id=user.id, attachment_ids=message.attachment_ids
    )

    await create_prompt(db, chat=chat, prompt=message.prompt, attachments=attachments)
    history = await get_history(db, storage, chat_id=chat.id)
    return _stream_reply(
        db,
        registry,
        http,
        adapter=adapter,
        spec=spec,
        user=user,
        chat=chat,
        history=history,
        prompt=message.prompt,
        effort=message.effort,
    )


async def retry_reply(
    db: AsyncSession,
    storage: S3Client,
    registry: LLMRegistry,
    http: httpx2.AsyncClient,
    *,
    adapter: ChatAdapter,
    user: User,
    chat: Chat,
    retry: RetryRequest,
) -> AsyncIterator[BaseChunk]:
    """Return a new reply's stream for the chat's last prompt.

    The old reply, if any, is replaced only once the new one is stored, so a
    retry that fails or is cut off keeps it.
    """
    spec = registry.spec(retry.model_id)
    if spec is None:
        raise ModelNotFound(loc=["body", "modelId"])

    prompt = await service.get_last_prompt(db, chat_id=chat.id)
    if prompt is None:
        raise NothingToRetry()
    if prompt.attachments and not spec.supports_files:
        raise ModelCannotAcceptFiles(loc=["body", "modelId"])

    # From the stored row, which holds the text alone; the history's copy of the
    # prompt has its attachments mixed in.
    [request] = ModelMessagesTypeAdapter.validate_python([prompt.content])
    history = await get_history(db, storage, chat_id=chat.id, through=prompt.id)
    return _stream_reply(
        db,
        registry,
        http,
        adapter=adapter,
        spec=spec,
        user=user,
        chat=chat,
        history=history,
        prompt=_prompt_text(cast(ModelRequest, request)),
        effort=retry.effort,
        replace_after=prompt.id,
    )


async def rename_chat(db: AsyncSession, *, chat: Chat, name: str) -> Chat:
    chat = await service.rename_chat(db, chat=chat, name=name)
    await db.commit()
    return chat
