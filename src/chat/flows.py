import asyncio
from collections.abc import AsyncIterator, Sequence
from typing import cast
from uuid import uuid4

from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.sse import ServerSentEvent
from mypy_boto3_s3 import S3Client
from pydantic_ai.exceptions import AgentRunError
from pydantic_ai.messages import (
    DocumentUrl,
    ImageUrl,
    ModelMessage,
    ModelMessagesTypeAdapter,
    ModelRequest,
    UserContent,
    UserPromptPart,
)
from pydantic_ai.models import Model
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User
from src.chat import service
from src.chat.config import chat_settings
from src.chat.constants import ALLOWED_MEDIA_TYPES, CHAT_NAME_LENGTH
from src.chat.exceptions import (
    AttachmentTooLarge,
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
)
from src.exceptions import AppError
from src.llm.agents import agent, title_agent
from src.llm.constants import TITLE_MODEL_ID
from src.llm.exceptions import ModelError
from src.llm.models import UserContext
from src.llm.registry import LLMRegistry
from src.logging import get_logger
from src.pagination import Page, PageParams
from src.storage import presigned_url

logger = get_logger(__name__)


async def _add_prompt(
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
            logger.warning(
                "Attachments were claimed by another message",
                chat_id=chat.id,
                expected=len(attachments),
                claimed=claimed,
            )

    await service.touch_chat(db, chat_id=chat.id)


async def create_chat(
    db: AsyncSession, *, user_id: int, prompt: str, attachments: Sequence[Attachment]
) -> Chat:
    """Start a chat with its first prompt, named after the prompt until titled."""
    chat = await service.create_chat(
        db, user_id=user_id, name=prompt[:CHAT_NAME_LENGTH]
    )
    await _add_prompt(db, chat=chat, prompt=prompt, attachments=attachments)
    await db.commit()
    return chat


async def create_prompt(
    db: AsyncSession, *, chat: Chat, prompt: str, attachments: Sequence[Attachment]
) -> None:
    await _add_prompt(db, chat=chat, prompt=prompt, attachments=attachments)
    await db.commit()


async def generate_chat_name(registry: LLMRegistry, *, prompt: str) -> str | None:
    """Ask a cheap model to title a new chat, or return None to keep its placeholder.

    Runs alongside the reply, which is using the request's session, so this must
    not touch the database; the caller saves the name once the reply is stored.
    """
    spec = registry.spec(TITLE_MODEL_ID)
    if spec is None:
        return None

    try:
        result = await title_agent.run(prompt, model=registry.model(spec))
    except Exception:
        logger.exception("chat_name_failed")
        return None

    name = result.output
    return name[:CHAT_NAME_LENGTH] or None


async def apply_chat_name(db: AsyncSession, *, chat: Chat, name: str) -> None:
    """Give a new chat its generated name, unless the user renamed it meanwhile.

    chat.name still holds the placeholder the chat was created with, since a
    rename arrives through another request's session and this one never reloads
    the chat.
    """
    await service.rename_chat_if_unchanged(
        db, chat_id=chat.id, old_name=chat.name, new_name=name
    )
    await db.commit()


async def delete_chat(db: AsyncSession, *, chat: Chat) -> None:
    await service.delete_chat(db, chat=chat)
    await db.commit()


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
    """Sign a URL the attachment can be read from for a short while."""
    return presigned_url(
        storage,
        bucket=chat_settings.s3_private_bucket,
        key=attachment.key,
        expires_in=chat_settings.attachment_url_ttl,
    )


def attachment_public(attachment: Attachment, storage: S3Client) -> AttachmentPublic:
    """Return the attachment as the API serves it, with a freshly signed URL."""
    return AttachmentPublic(
        id=attachment.id,
        filename=attachment.filename,
        media_type=attachment.media_type,
        url=_attachment_url(attachment, storage),
    )


def _attachment_parts(
    attachments: Sequence[Attachment], storage: S3Client
) -> list[UserContent]:
    """Render attachments as prompt content the model can fetch.

    Each file is named in a text part of its own, because a `FileUrl`'s own
    identifier only reaches the model when a tool returns it.

    The media type is passed explicitly: a signed URL carries a query string,
    so Pydantic AI cannot infer the type from it.
    """
    parts: list[UserContent] = []
    for attachment in attachments:
        url = _attachment_url(attachment, storage)
        content = (
            ImageUrl if attachment.media_type.startswith("image/") else DocumentUrl
        )
        parts.append(f'File "{attachment.filename}":')
        parts.append(content(url=url, media_type=attachment.media_type))
    return parts


async def get_history(
    db: AsyncSession, storage: S3Client, *, chat_id: int
) -> list[ModelMessage]:
    """Return the chat so far, in the form an agent run takes as its history.

    Attachments are added back from their own rows, with freshly signed URLs,
    since the stored message holds the prompt text alone. The prompt being
    answered is already stored, so the history ends with it.
    """
    rows = await service.get_messages(db, chat_id=chat_id)
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
            content = "".join(
                part.content
                for part in message.parts
                if isinstance(part, UserPromptPart) and isinstance(part.content, str)
            )
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
    db: AsyncSession, *, chat_id: int, messages: list[ModelMessage], model_id: str
) -> None:
    """Store the messages a run produced after its prompt, one row each.

    Only the reply records the model, so a chat continued with a different one
    stays accurate about which model said what.
    """
    for content in ModelMessagesTypeAdapter.dump_python(messages, mode="json"):
        await service.create_message(
            db,
            chat_id=chat_id,
            content=content,
            model_id=model_id if content["kind"] == "response" else None,
        )
    await db.commit()


async def send_message(
    db: AsyncSession,
    storage: S3Client,
    registry: LLMRegistry,
    *,
    user: User,
    chat: Chat | None,
    message: MessageRequest,
    model: Model,
    attachments: Sequence[Attachment],
) -> AsyncIterator[ServerSentEvent]:
    """Store the prompt, then stream the reply to it and store that too.

    The prompt is stored before the run, so a reply that fails or is cut off
    still leaves it in the chat. The response has already started by the time
    anything here can fail, so a failure ends the stream with an error event
    instead of an error response.
    """
    name_task = None
    try:
        if chat is None:
            chat = await create_chat(
                db, user_id=user.id, prompt=message.prompt, attachments=attachments
            )
            name_task = asyncio.create_task(
                generate_chat_name(registry, prompt=message.prompt)
            )
        else:
            await create_prompt(
                db, chat=chat, prompt=message.prompt, attachments=attachments
            )

        yield ServerSentEvent(data={"id": chat.id}, event="chat")

        # With no user prompt given, the run resumes from the stored prompt that
        # ends the history, and leaves it out of new_messages().
        history = await get_history(db, storage, chat_id=chat.id)

        async with agent.run_stream(
            model=model,
            message_history=history,
            deps=UserContext(name=user.name, instructions=user.instructions),
        ) as result:
            async for text in result.stream_text(delta=True):
                yield ServerSentEvent(data=text)

            # Only reached when the stream ran to completion.
            await create_reply(
                db,
                chat_id=chat.id,
                messages=result.new_messages(),
                model_id=message.model_id,
            )

        if name_task is not None and (name := await name_task):
            await apply_chat_name(db, chat=chat, name=name)

    except Exception as exc:
        error = ModelError() if isinstance(exc, AgentRunError) else AppError()
        logger.exception("reply_failed", model_id=message.model_id)
        yield ServerSentEvent(data={"detail": [error.serialize()]}, event="error")
    finally:
        if name_task is not None:
            name_task.cancel()


async def rename_chat(db: AsyncSession, *, chat: Chat, name: str) -> Chat:
    chat = await service.rename_chat(db, chat=chat, name=name)
    await db.commit()
    return chat
