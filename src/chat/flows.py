from collections.abc import Sequence
from typing import cast
from uuid import uuid4

from fastapi import UploadFile
from fastapi.concurrency import run_in_threadpool
from mypy_boto3_s3 import S3Client
from pydantic_ai.messages import (
    DocumentUrl,
    ImageUrl,
    ModelMessage,
    ModelMessagesTypeAdapter,
    ModelRequest,
    UserContent,
    UserPromptPart,
)
from sqlalchemy.ext.asyncio import AsyncSession

from src.chat import service
from src.chat.config import chat_settings
from src.chat.exceptions import (
    AttachmentTooLarge,
    TooManyAttachments,
    UnsupportedAttachmentType,
)
from src.chat.models import Attachment, AttachmentPublic, Chat, MessagePublic
from src.logging import get_logger
from src.storage import presigned_url

logger = get_logger(__name__)

CHAT_NAME_LENGTH = 60

ALLOWED_MEDIA_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
)


async def create_chat(db: AsyncSession, *, user_id: int, prompt: str) -> Chat:
    """Open a chat named after the prompt that started it."""
    chat = await service.create_chat(
        db, user_id=user_id, name=prompt[:CHAT_NAME_LENGTH]
    )
    await db.commit()
    return chat


async def delete_chat(db: AsyncSession, *, chat: Chat) -> None:
    await service.delete_chat(db, chat=chat)
    await db.commit()


async def list_chats(db: AsyncSession, *, user_id: int) -> Sequence[Chat]:
    chats = await service.list_chats(db, user_id=user_id)
    return chats


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


def attachment_parts(
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
    since the stored message holds the prompt text alone.
    """
    rows = await service.get_messages(db, chat_id=chat_id)
    history = ModelMessagesTypeAdapter.validate_python([row.content for row in rows])

    for row, message in zip(rows, history, strict=True):
        if not row.attachments:
            continue

        parts = attachment_parts(row.attachments, storage)
        for part in message.parts:
            if isinstance(part, UserPromptPart) and isinstance(part.content, str):
                part.content = [part.content, *parts]

    # Released before the reply starts streaming, so the connection is not held
    # idle in a transaction for as long as the model takes to answer.
    await db.commit()
    return history


async def get_messages(
    db: AsyncSession, storage: S3Client, *, chat_id: int
) -> list[MessagePublic]:
    """Return the chat so far as plain text, oldest first."""
    rows = await service.get_messages(db, chat_id=chat_id)
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
    return transcript


def _without_files(content: dict, *, prompt: str) -> dict:
    """Reduce a stored prompt to its text.

    The run was handed signed URLs that expire, and the files are already
    recorded as attachment rows, so neither belongs in the message itself.
    """
    for part in content["parts"]:
        if part["part_kind"] == "user-prompt":
            part["content"] = prompt
    return content


async def create_message(
    db: AsyncSession,
    *,
    chat_id: int,
    messages: list[ModelMessage],
    model_id: str,
    prompt: str,
    attachments: Sequence[Attachment],
) -> None:
    """Store the messages a single run produced, one row each.

    Only the reply records the model, so a chat continued with a different one
    stays accurate about which model said what. The prompt claims the
    attachments, which have been waiting unattached since they were uploaded.
    """
    for content in ModelMessagesTypeAdapter.dump_python(messages, mode="json"):
        is_reply = content["kind"] == "response"
        message = await service.create_message(
            db,
            chat_id=chat_id,
            content=_without_files(content, prompt=prompt),
            model_id=model_id if is_reply else None,
        )

        if not is_reply and attachments:
            claimed = await service.attach_to_message(
                db,
                attachment_ids=[attachment.id for attachment in attachments],
                message_id=message.id,
            )
            if claimed != len(attachments):
                logger.warning(
                    "Attachments were claimed by another message",
                    chat_id=chat_id,
                    expected=len(attachments),
                    claimed=claimed,
                )
    await db.commit()


async def rename_chat(db: AsyncSession, *, chat: Chat, name: str) -> Chat:
    chat = await service.rename_chat(db, chat=chat, name=name)
    await db.commit()
    return chat