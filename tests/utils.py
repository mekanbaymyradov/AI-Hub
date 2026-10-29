import json
from collections.abc import Sequence
from uuid import uuid4

from httpx2 import AsyncClient, EventSource, Response
from mypy_boto3_s3 import S3Client
from pydantic_ai.messages import ModelMessage, ModelMessagesTypeAdapter
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import service
from src.auth.models import User
from src.chat import service as chat_service
from src.chat.models import Attachment, Chat, Message
from src.config import settings

MODEL_ID = "groq:test-model"  # served by the llm_registry fixture in conftest
REPLY = "Hi there, friend."  # what every llm_registry fixture model answers


async def request_code(
    client: AsyncClient, sent_codes: dict[str, str], email: str
) -> str:
    """Request a sign-in code and return the code the app emailed."""
    response = await client.post("/auth/otp/request", json={"email": email})
    assert response.status_code == 202
    return sent_codes[email]


async def verify_code(client: AsyncClient, email: str, code: str) -> Response:
    return await client.post("/auth/otp/verify", json={"email": email, "code": code})


async def sign_in(client: AsyncClient, sent_codes: dict[str, str], email: str) -> str:
    """Sign in over HTTP and return the access token."""
    code = await request_code(client, sent_codes, email)
    response = await verify_code(client, email, code)
    assert response.status_code == 200
    return response.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def upload_avatar(
    client: AsyncClient,
    token: str,
    *,
    content: bytes = b"fake-webp",
    content_type: str = "image/webp",
) -> Response:
    return await client.put(
        "/auth/me/avatar",
        headers=auth_header(token),
        files={"file": ("avatar.webp", content, content_type)},
    )


def stored_avatar_keys(s3: S3Client) -> list[str]:
    """Keys of the avatar objects in the public bucket."""
    response = s3.list_objects_v2(Bucket=settings.s3_public_bucket, Prefix="avatars/")
    return [obj["Key"] for obj in response.get("Contents", [])]


async def store_avatar(s3: S3Client, db: AsyncSession, user: User) -> str:
    """Give the user an avatar without the endpoint and return its key."""
    key = f"avatars/{user.id}/old.webp"
    s3.put_object(
        Bucket=settings.s3_public_bucket,
        Key=key,
        Body=b"fake-webp",
        ContentType="image/webp",
    )
    await service.update_avatar(db, user=user, avatar_key=key)
    return key


async def send_message(
    client: AsyncClient,
    token: str,
    *,
    chat_id: int,
    prompt: str = "Hello",
    model_id: str = MODEL_ID,
    attachment_ids: Sequence[int] = (),
    effort: str | None = None,
) -> Response:
    return await client.post(
        f"/chats/{chat_id}/messages",
        headers=auth_header(token),
        json={
            "trigger": "submit-message",
            "id": str(uuid4()),
            "messages": [
                {
                    "id": str(uuid4()),
                    "role": "user",
                    "parts": [{"type": "text", "text": prompt}],
                }
            ],
            "modelId": model_id,
            "attachmentIds": list(attachment_ids),
            "effort": effort,
        },
    )


async def retry_reply(
    client: AsyncClient,
    token: str,
    *,
    chat_id: int,
    model_id: str = MODEL_ID,
    messages: Sequence[dict] = (),
) -> Response:
    return await client.post(
        f"/chats/{chat_id}/retry",
        headers=auth_header(token),
        json={
            "trigger": "regenerate-message",
            "id": str(uuid4()),
            "messages": list(messages),
            "modelId": model_id,
        },
    )


async def stream_chunks(response: Response) -> list[dict]:
    """Return the UI message stream's chunks, without its closing [DONE]."""
    events = [event async for event in EventSource(response)]
    assert events[-1].data == "[DONE]"
    return [json.loads(event.data) for event in events[:-1]]


def streamed_text(chunks: list[dict]) -> str:
    """Join the reply's text deltas, however the stream happened to batch them."""
    return "".join(c["delta"] for c in chunks if c["type"] == "text-delta")


async def add_message(
    db: AsyncSession,
    chat: Chat,
    message: ModelMessage,
    model_id: str | None = None,
) -> Message:
    """Store a message in the chat without the send endpoint."""
    content = ModelMessagesTypeAdapter.dump_python([message], mode="json")[0]
    return await chat_service.create_message(
        db, chat_id=chat.id, content=content, model_id=model_id
    )


async def store_attachment(
    s3: S3Client, db: AsyncSession, *, user_id: int, message_id: int | None = None
) -> Attachment:
    """Upload a file without the endpoint, claimed by `message_id` if given."""
    key = f"attachments/{user_id}/{uuid4().hex}"
    s3.put_object(
        Bucket=settings.s3_private_bucket,
        Key=key,
        Body=b"fake-png",
        ContentType="image/png",
    )
    attachment = await chat_service.create_attachment(
        db, user_id=user_id, key=key, filename="photo.png", media_type="image/png"
    )
    if message_id is not None:
        await chat_service.attach_to_message(
            db, attachment_ids=[attachment.id], message_id=message_id
        )
    return attachment


def stored_attachment_keys(s3: S3Client) -> list[str]:
    """Keys of the attachment objects in the private bucket."""
    response = s3.list_objects_v2(
        Bucket=settings.s3_private_bucket, Prefix="attachments/"
    )
    return [obj["Key"] for obj in response.get("Contents", [])]


async def upload_attachments(
    client: AsyncClient, token: str, files: list[tuple[str, bytes, str]]
) -> Response:
    """Upload (filename, content, content type) files as one request."""
    return await client.post(
        "/chats/attachments",
        headers=auth_header(token),
        files=[("files", file) for file in files],
    )
