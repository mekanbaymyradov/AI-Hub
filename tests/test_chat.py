import json
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import ANY

import pytest
from httpx2 import AsyncClient
from mypy_boto3_s3 import S3Client
from pydantic_ai import capture_run_messages
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.messages import (
    ImageUrl,
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
    UserPromptPart,
)
from pydantic_ai.models.function import (
    AgentInfo,
    DeltaToolCall,
    DeltaToolCalls,
    FunctionModel,
)
from pydantic_ai.models.test import TestModel
from pydantic_ai.profiles import ModelProfile
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth.models import User
from src.chat import service as chat_service
from src.chat.config import chat_settings
from src.chat.constants import NEW_CHAT_NAME
from src.chat.models import Chat
from src.config import settings
from src.llm.agents import agent
from src.llm.constants import TITLE_MODEL_ID
from src.llm.dependencies import get_llm_registry
from src.llm.models import CATALOG
from src.llm.registry import LLMRegistry
from src.main import app
from tests.utils import (
    MODEL_ID,
    REPLY,
    add_message,
    auth_header,
    retry_reply,
    send_message,
    store_attachment,
    stored_attachment_keys,
    stream_chunks,
    streamed_text,
    upload_attachments,
)

pytestmark = pytest.mark.anyio


@pytest.fixture
async def new_chat(db_session: AsyncSession, user: User) -> Chat:
    return await chat_service.create_chat(
        db_session, user_id=user.id, name=NEW_CHAT_NAME
    )


# List chats


async def test_list_chats_returns_only_own_chats(
    client: AsyncClient,
    db_session: AsyncSession,
    user: User,
    other_user: User,
    token: str,
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="My chat")
    await chat_service.create_chat(db_session, user_id=other_user.id, name="Their chat")

    response = await client.get("/chats", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {"id": chat.id, "name": "My chat", "created_at": ANY, "updated_at": ANY}
        ],
        "next_cursor": None,
    }


async def test_list_chats_orders_by_last_activity(
    client: AsyncClient, db_session: AsyncSession, user: User, token: str
):
    # Created first, so only updated_at can put it ahead of the other chat.
    active = await chat_service.create_chat(db_session, user_id=user.id, name="Active")
    idle = await chat_service.create_chat(db_session, user_id=user.id, name="Idle")
    # now() is fixed for the whole test transaction, so set the times explicitly.
    active.updated_at = datetime(2026, 1, 2, tzinfo=UTC)
    idle.updated_at = datetime(2026, 1, 1, tzinfo=UTC)
    await db_session.flush()

    response = await client.get("/chats", headers=auth_header(token))

    assert response.status_code == 200
    assert [chat["id"] for chat in response.json()["items"]] == [active.id, idle.id]


async def test_list_chats_paginates(
    client: AsyncClient, db_session: AsyncSession, user: User, token: str
):
    # All share one updated_at, so the cursor must fall back to the id to split them.
    first, second, third = [
        await chat_service.create_chat(db_session, user_id=user.id, name=f"Chat {i}")
        for i in range(3)
    ]

    response = await client.get(
        "/chats", params={"limit": 2}, headers=auth_header(token)
    )

    assert response.status_code == 200
    page = response.json()
    assert [chat["id"] for chat in page["items"]] == [third.id, second.id]
    response = await client.get(
        "/chats",
        params={"limit": 2, "cursor": page["next_cursor"]},
        headers=auth_header(token),
    )
    assert response.status_code == 200
    page = response.json()
    assert [chat["id"] for chat in page["items"]] == [first.id]
    assert page["next_cursor"] is None


async def test_list_chats_rejects_invalid_cursor(client: AsyncClient, token: str):
    response = await client.get(
        "/chats", params={"cursor": "not-a-cursor"}, headers=auth_header(token)
    )

    assert response.status_code == 422
    error = response.json()["detail"][0]
    assert error["type"] == "invalid_cursor"
    assert error["loc"] == ["query", "cursor"]


# Create chat


async def test_create_chat_starts_unnamed(client: AsyncClient, token: str):
    response = await client.post("/chats", headers=auth_header(token))

    assert response.status_code == 201
    chat = response.json()
    assert chat == {
        "id": ANY,
        "name": NEW_CHAT_NAME,
        "created_at": ANY,
        "updated_at": ANY,
    }
    chats = await client.get("/chats", headers=auth_header(token))
    assert [c["id"] for c in chats.json()["items"]] == [chat["id"]]


# Rename chat


async def test_rename_chat_changes_name(
    client: AsyncClient, db_session: AsyncSession, user: User, token: str
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="Old name")

    response = await client.patch(
        f"/chats/{chat.id}/rename",
        json={"name": "New name"},
        headers=auth_header(token),
    )

    assert response.status_code == 200
    assert response.json() == {
        "id": chat.id,
        "name": "New name",
        "created_at": ANY,
        "updated_at": ANY,
    }


# Delete chats


async def test_delete_chats_removes_them(
    client: AsyncClient, db_session: AsyncSession, user: User, token: str
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="My chat")
    chat2 = await chat_service.create_chat(
        db_session, user_id=user.id, name="My second chat"
    )

    response = await client.delete(
        "/chats", headers=auth_header(token), params={"chat_ids": [chat.id, chat2.id]}
    )

    assert response.status_code == 204
    chats = await client.get("/chats", headers=auth_header(token))
    assert chats.json()["items"] == []


async def test_delete_chat_deletes_its_attachment_files(
    client: AsyncClient,
    s3: S3Client,
    db_session: AsyncSession,
    user: User,
    token: str,
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="Doomed")
    prompt = await add_message(
        db_session, chat, ModelRequest(parts=[UserPromptPart("See this")])
    )
    await store_attachment(s3, db_session, user_id=user.id, message_id=prompt.id)
    other_chat = await chat_service.create_chat(
        db_session, user_id=user.id, name="Kept"
    )
    other_prompt = await add_message(
        db_session, other_chat, ModelRequest(parts=[UserPromptPart("And this")])
    )
    kept = await store_attachment(
        s3, db_session, user_id=user.id, message_id=other_prompt.id
    )

    response = await client.delete(
        "/chats", headers=auth_header(token), params={"chat_ids": [chat.id]}
    )

    assert response.status_code == 204
    assert stored_attachment_keys(s3) == [kept.key]


async def test_delete_chat_cant_remove_others_chat(
    client: AsyncClient, db_session: AsyncSession, other_user: User, token: str
):
    chat = await chat_service.create_chat(
        db_session, user_id=other_user.id, name="Their chat"
    )

    response = await client.delete(
        "/chats", headers=auth_header(token), params={"chat_ids": [chat.id]}
    )

    assert response.status_code == 404
    error = response.json()["detail"][0]
    assert error["type"] == "chat.chat_not_found"
    assert error["loc"] == ["query", "chat_ids"]


async def test_delete_chats_with_a_foreign_id_deletes_nothing(
    client: AsyncClient,
    db_session: AsyncSession,
    user: User,
    other_user: User,
    token: str,
):
    mine = await chat_service.create_chat(db_session, user_id=user.id, name="Mine")
    theirs = await chat_service.create_chat(
        db_session, user_id=other_user.id, name="Theirs"
    )

    response = await client.delete(
        "/chats", headers=auth_header(token), params={"chat_ids": [mine.id, theirs.id]}
    )

    assert response.status_code == 404
    chats = await client.get("/chats", headers=auth_header(token))
    assert [c["id"] for c in chats.json()["items"]] == [mine.id]


# Messages


async def test_list_messages_returns_transcript(
    client: AsyncClient, db_session: AsyncSession, user: User, token: str
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="My chat")
    prompt = await add_message(
        db_session, chat, ModelRequest(parts=[UserPromptPart("Hi")])
    )
    reply = await add_message(
        db_session,
        chat,
        ModelResponse(parts=[TextPart("Hello!")]),
        model_id=MODEL_ID,
    )

    response = await client.get(
        f"/chats/{chat.id}/messages", headers=auth_header(token)
    )

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": prompt.id,
                "kind": "request",
                "content": "Hi",
                "model_id": None,
                "created_at": ANY,
                "attachments": [],
            },
            {
                "id": reply.id,
                "kind": "response",
                "content": "Hello!",
                "model_id": MODEL_ID,
                "created_at": ANY,
                "attachments": [],
            },
        ],
        "next_cursor": None,
    }


async def test_list_messages_skips_messages_without_text(
    client: AsyncClient, db_session: AsyncSession, user: User, token: str
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="My chat")
    await add_message(
        db_session, chat, ModelRequest(parts=[UserPromptPart("Weather?")])
    )
    await add_message(
        db_session,
        chat,
        ModelResponse(parts=[ToolCallPart("get_weather", {"city": "Ashgabat"})]),
        model_id=MODEL_ID,
    )
    await add_message(
        db_session, chat, ModelRequest(parts=[ToolReturnPart("get_weather", "Sunny")])
    )
    await add_message(
        db_session,
        chat,
        ModelResponse(parts=[TextPart("It's sunny.")]),
        model_id=MODEL_ID,
    )

    response = await client.get(
        f"/chats/{chat.id}/messages", headers=auth_header(token)
    )

    assert response.status_code == 200
    contents = [message["content"] for message in response.json()["items"]]
    assert contents == ["Weather?", "It's sunny."]


async def test_list_messages_includes_attachments(
    client: AsyncClient,
    s3: S3Client,
    db_session: AsyncSession,
    user: User,
    token: str,
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="My chat")
    prompt = await add_message(
        db_session, chat, ModelRequest(parts=[UserPromptPart("What is this?")])
    )
    attachment = await store_attachment(
        s3, db_session, user_id=user.id, message_id=prompt.id
    )

    response = await client.get(
        f"/chats/{chat.id}/messages", headers=auth_header(token)
    )

    assert response.status_code == 200
    [message] = response.json()["items"]
    assert message["attachments"] == [
        {
            "id": attachment.id,
            "filename": "photo.png",
            "media_type": "image/png",
            "url": ANY,
        }
    ]
    assert attachment.key in message["attachments"][0]["url"]


async def test_list_messages_paginates_newest_first(
    client: AsyncClient, db_session: AsyncSession, user: User, token: str
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="My chat")
    first, second, third = [
        await add_message(
            db_session, chat, ModelRequest(parts=[UserPromptPart(f"Message {i}")])
        )
        for i in range(3)
    ]

    response = await client.get(
        f"/chats/{chat.id}/messages", params={"limit": 2}, headers=auth_header(token)
    )

    assert response.status_code == 200
    page = response.json()
    assert [message["id"] for message in page["items"]] == [second.id, third.id]
    response = await client.get(
        f"/chats/{chat.id}/messages",
        params={"limit": 2, "cursor": page["next_cursor"]},
        headers=auth_header(token),
    )
    assert response.status_code == 200
    page = response.json()
    assert [message["id"] for message in page["items"]] == [first.id]
    assert page["next_cursor"] is None


# Attachments


async def test_upload_attachments_stores_files(
    client: AsyncClient, s3: S3Client, token: str
):
    response = await upload_attachments(
        client,
        token,
        [
            ("photo.png", b"fake-png", "image/png"),
            ("doc.pdf", b"fake-pdf", "application/pdf"),
        ],
    )

    assert response.status_code == 201
    assert response.json() == [
        {"id": ANY, "filename": "photo.png", "media_type": "image/png", "url": ANY},
        {"id": ANY, "filename": "doc.pdf", "media_type": "application/pdf", "url": ANY},
    ]
    keys = stored_attachment_keys(s3)
    assert len(keys) == 2
    for attachment in response.json():
        [key] = [key for key in keys if key in attachment["url"]]
        stored = s3.head_object(Bucket=settings.s3_private_bucket, Key=key)
        assert stored["ContentType"] == attachment["media_type"]


async def test_upload_attachments_rejects_unsupported_type(
    client: AsyncClient, s3: S3Client, token: str
):
    response = await upload_attachments(
        client,
        token,
        [
            ("photo.png", b"fake-png", "image/png"),
            ("notes.txt", b"hello", "text/plain"),
        ],
    )

    assert response.status_code == 415
    error = response.json()["detail"][0]
    assert error["type"] == "chat.unsupported_attachment_type"
    assert error["loc"] == ["body", "files", 1]
    # The valid file sent ahead of it is not stored either.
    assert stored_attachment_keys(s3) == []


async def test_upload_attachments_rejects_too_large(
    client: AsyncClient,
    s3: S3Client,
    token: str,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(chat_settings, "attachment_max_bytes", 10)

    response = await upload_attachments(
        client, token, [("photo.png", b"x" * 11, "image/png")]
    )

    assert response.status_code == 413
    assert response.json()["detail"][0]["type"] == "chat.attachment_too_large"
    assert stored_attachment_keys(s3) == []


async def test_upload_attachments_rejects_too_many(
    client: AsyncClient, s3: S3Client, token: str
):
    files = [("photo.png", b"fake-png", "image/png")] * (
        chat_settings.attachment_max_count + 1
    )

    response = await upload_attachments(client, token, files)

    assert response.status_code == 422
    assert response.json()["detail"][0]["type"] == "chat.too_many_attachments"
    assert stored_attachment_keys(s3) == []


# Send message


async def test_send_message_replies_and_names_chat(
    client: AsyncClient, token: str, new_chat: Chat
):
    response = await send_message(client, token, chat_id=new_chat.id, prompt="Hello")

    assert response.status_code == 200
    chunks = await stream_chunks(response)
    assert streamed_text(chunks) == REPLY
    assert "error" not in [chunk["type"] for chunk in chunks]
    # No title model in the fixture registry, so the prompt becomes the name.
    assert {
        "type": "data-chat-name",
        "data": {"name": "Hello"},
        "transient": True,
    } in chunks
    messages = await client.get(
        f"/chats/{new_chat.id}/messages", headers=auth_header(token)
    )
    assert [
        (message["kind"], message["content"], message["model_id"])
        for message in messages.json()["items"]
    ] == [("request", "Hello", None), ("response", REPLY, MODEL_ID)]
    chats = await client.get("/chats", headers=auth_header(token))
    assert [chat["name"] for chat in chats.json()["items"]] == ["Hello"]


async def test_send_message_continues_chat(
    client: AsyncClient, db_session: AsyncSession, user: User, token: str
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="My chat")
    await add_message(
        db_session, chat, ModelRequest(parts=[UserPromptPart("First question")])
    )
    await add_message(
        db_session,
        chat,
        ModelResponse(parts=[TextPart("First answer")]),
        model_id=MODEL_ID,
    )

    with capture_run_messages() as messages:
        response = await send_message(
            client, token, prompt="Second question", chat_id=chat.id
        )

    assert response.status_code == 200
    chunks = await stream_chunks(response)
    # Only a chat still named NEW_CHAT_NAME is given a title.
    assert "data-chat-name" not in [chunk["type"] for chunk in chunks]
    seen = [
        part.content
        for message in messages[:3]
        for part in message.parts
        if isinstance(part, UserPromptPart | TextPart)
    ]
    assert seen == ["First question", "First answer", "Second question"]
    stored = await client.get(f"/chats/{chat.id}/messages", headers=auth_header(token))
    assert [message["content"] for message in stored.json()["items"]] == [
        "First question",
        "First answer",
        "Second question",
        REPLY,
    ]


async def test_send_message_names_new_chat(
    client: AsyncClient, llm_registry: LLMRegistry, token: str, new_chat: Chat
):
    spec = llm_registry.spec(MODEL_ID)
    assert spec is not None
    title_spec = next(spec for spec in CATALOG if spec.id == TITLE_MODEL_ID)
    registry = LLMRegistry(
        models={
            spec.id: llm_registry.model(spec),
            title_spec.id: TestModel(custom_output_text="Greeting"),
        },
        specs={spec.id: spec, title_spec.id: title_spec},
    )
    app.dependency_overrides[get_llm_registry] = lambda: registry

    response = await send_message(client, token, chat_id=new_chat.id, prompt="Hello")

    assert response.status_code == 200
    chunks = await stream_chunks(response)
    assert {
        "type": "data-chat-name",
        "data": {"name": "Greeting"},
        "transient": True,
    } in chunks
    chats = await client.get("/chats", headers=auth_header(token))
    assert [chat["name"] for chat in chats.json()["items"]] == ["Greeting"]


async def test_send_message_sends_attachments(
    client: AsyncClient,
    s3: S3Client,
    db_session: AsyncSession,
    user: User,
    token: str,
    new_chat: Chat,
):
    attachment = await store_attachment(s3, db_session, user_id=user.id)

    with capture_run_messages() as messages:
        response = await send_message(
            client,
            token,
            chat_id=new_chat.id,
            prompt="What is this?",
            attachment_ids=[attachment.id],
        )

    assert response.status_code == 200
    prompt = messages[0].parts[0]
    assert isinstance(prompt, UserPromptPart)
    assert prompt.content[:2] == ["What is this?", 'File "photo.png":']
    image = prompt.content[2]
    assert isinstance(image, ImageUrl)
    assert attachment.key in image.url
    stored = await client.get(
        f"/chats/{new_chat.id}/messages", headers=auth_header(token)
    )
    [stored_prompt, _] = stored.json()["items"]
    assert [a["id"] for a in stored_prompt["attachments"]] == [attachment.id]


async def test_send_message_runs_tool_after_text(
    client: AsyncClient, token: str, new_chat: Chat
):
    async def reply(
        messages: list[ModelMessage], _info: AgentInfo
    ) -> AsyncIterator[str | DeltaToolCalls]:
        if len(messages) == 1:
            # Text ahead of a call in one response: Agent.run_stream() would
            # stop here.
            yield "Let me check. "
            yield {0: DeltaToolCall(name="get_current_time", json_args="{}")}
        else:
            yield "Done."

    with agent.override(model=FunctionModel(stream_function=reply)):
        response = await send_message(
            client, token, chat_id=new_chat.id, prompt="What time is it?"
        )

    assert response.status_code == 200
    assert streamed_text(await stream_chunks(response)) == "Let me check. Done."
    stored = await client.get(
        f"/chats/{new_chat.id}/messages", headers=auth_header(token)
    )
    assert [message["content"] for message in stored.json()["items"]] == [
        "What time is it?",
        "Let me check. ",
        "Done.",
    ]


@pytest.mark.parametrize("effort", ["high", None])
async def test_send_message_passes_effort(
    client: AsyncClient, token: str, new_chat: Chat, effort: str | None
):
    seen = []

    async def reply(
        _messages: list[ModelMessage], info: AgentInfo
    ) -> AsyncIterator[str]:
        seen.append(info.model_request_parameters.thinking)
        yield "Done."

    # Like every catalog model; without it, pydantic-ai drops the setting.
    model = FunctionModel(
        stream_function=reply, profile=ModelProfile(supports_thinking=True)
    )
    with agent.override(model=model):
        response = await send_message(client, token, chat_id=new_chat.id, effort=effort)

    assert response.status_code == 200
    assert seen == [effort]


async def test_send_message_reports_model_failure(
    client: AsyncClient, token: str, new_chat: Chat
):
    async def fail(
        _messages: list[ModelMessage], _info: AgentInfo
    ) -> AsyncIterator[str]:
        yield "Partial "
        raise ModelHTTPError(status_code=503, model_name="test")

    with agent.override(model=FunctionModel(stream_function=fail)):
        response = await send_message(
            client, token, chat_id=new_chat.id, prompt="Hello"
        )

    # Headers went out with the first chunk, so the failure arrives in the stream.
    assert response.status_code == 200
    chunks = await stream_chunks(response)
    [error] = [chunk for chunk in chunks if chunk["type"] == "error"]
    assert json.loads(error["errorText"]) == {
        "detail": [{"msg": "The model failed to reply.", "type": "llm.model_error"}]
    }
    stored = await client.get(
        f"/chats/{new_chat.id}/messages", headers=auth_header(token)
    )
    assert [
        (message["kind"], message["content"]) for message in stored.json()["items"]
    ] == [("request", "Hello")]


@pytest.mark.parametrize(
    ("fields", "status", "error_type", "loc"),
    [
        pytest.param(
            {"model_id": "groq:missing"},
            404,
            "llm.model_not_found",
            ["body", "modelId"],
            id="unknown-model",
        ),
        pytest.param(
            # Checked before any lookup, so the id need not exist.
            {"model_id": "groq:text-only-model", "attachment_ids": [1]},
            422,
            "chat.model_cannot_accept_files",
            ["body", "attachmentIds"],
            id="files-on-text-only-model",
        ),
        pytest.param(
            {"prompt": ""},
            422,
            "value_error",
            ["body", "messages"],
            id="invalid-body",
        ),
    ],
)
async def test_send_message_rejects_before_streaming(
    client: AsyncClient,
    token: str,
    new_chat: Chat,
    fields: dict,
    status: int,
    error_type: str,
    loc: list[str],
):
    response = await send_message(client, token, chat_id=new_chat.id, **fields)

    assert response.status_code == status
    # Unpacking also checks that the error is not repeated.
    [error] = response.json()["detail"]
    assert error["type"] == error_type
    assert error["loc"] == loc


async def test_send_message_to_other_users_chat_is_not_found(
    client: AsyncClient, db_session: AsyncSession, other_user: User, token: str
):
    chat = await chat_service.create_chat(
        db_session, user_id=other_user.id, name="Their chat"
    )

    response = await send_message(client, token, chat_id=chat.id)

    assert response.status_code == 404
    [error] = response.json()["detail"]
    assert error["type"] == "chat.chat_not_found"
    assert error["loc"] == ["path", "chat_id"]


async def test_send_message_rejects_used_attachment(
    client: AsyncClient,
    s3: S3Client,
    db_session: AsyncSession,
    user: User,
    token: str,
    new_chat: Chat,
):
    prompt = await add_message(
        db_session, new_chat, ModelRequest(parts=[UserPromptPart("See this")])
    )
    attachment = await store_attachment(
        s3, db_session, user_id=user.id, message_id=prompt.id
    )

    response = await send_message(
        client, token, chat_id=new_chat.id, attachment_ids=[attachment.id]
    )

    assert response.status_code == 404
    [error] = response.json()["detail"]
    assert error["type"] == "chat.attachment_not_found"
    assert error["loc"] == ["body", "attachmentIds"]


# Retry


async def test_retry_replaces_last_reply(
    client: AsyncClient, db_session: AsyncSession, user: User, token: str
):
    chat = await chat_service.create_chat(db_session, user_id=user.id, name="My chat")
    for message in [
        ModelRequest(parts=[UserPromptPart("First question")]),
        ModelResponse(parts=[TextPart("First answer")]),
        ModelRequest(parts=[UserPromptPart("Second question")]),
        ModelResponse(parts=[TextPart("Bad answer")]),
    ]:
        await add_message(db_session, chat, message)

    with capture_run_messages() as messages:
        response = await retry_reply(client, token, chat_id=chat.id)

    assert response.status_code == 200
    chunks = await stream_chunks(response)
    assert streamed_text(chunks) == REPLY
    assert "data-chat-name" not in [chunk["type"] for chunk in chunks]
    seen = [
        part.content
        for message in messages
        for part in message.parts
        if isinstance(part, UserPromptPart | TextPart)
    ]
    assert seen == ["First question", "First answer", "Second question", REPLY]
    stored = await client.get(f"/chats/{chat.id}/messages", headers=auth_header(token))
    assert [message["content"] for message in stored.json()["items"]] == [
        "First question",
        "First answer",
        "Second question",
        REPLY,
    ]


async def test_retry_replaces_reply_with_tool_calls(
    client: AsyncClient, db_session: AsyncSession, token: str, new_chat: Chat
):
    for message in [
        ModelRequest(parts=[UserPromptPart("What time is it?")]),
        ModelResponse(parts=[ToolCallPart("get_current_time", {}, "call-1")]),
        ModelRequest(parts=[ToolReturnPart("get_current_time", "12:00", "call-1")]),
        ModelResponse(parts=[TextPart("It is noon.")]),
    ]:
        await add_message(db_session, new_chat, message)

    with capture_run_messages() as messages:
        response = await retry_reply(client, token, chat_id=new_chat.id)

    assert response.status_code == 200
    assert streamed_text(await stream_chunks(response)) == REPLY
    # The tool's result is a request too, yet the run starts over from the prompt.
    assert [part.part_kind for message in messages for part in message.parts] == [
        "user-prompt",
        "text",
    ]
    # The tool rows have no text, so only storage shows they are gone.
    assert len(await chat_service.get_messages(db_session, chat_id=new_chat.id)) == 2


async def test_retry_answers_unanswered_prompt_and_names_chat(
    client: AsyncClient, db_session: AsyncSession, token: str, new_chat: Chat
):
    await add_message(
        db_session, new_chat, ModelRequest(parts=[UserPromptPart("Hello")])
    )

    response = await retry_reply(client, token, chat_id=new_chat.id)

    assert response.status_code == 200
    chunks = await stream_chunks(response)
    assert streamed_text(chunks) == REPLY
    # No title model in the fixture registry, so the prompt becomes the name.
    assert {
        "type": "data-chat-name",
        "data": {"name": "Hello"},
        "transient": True,
    } in chunks
    stored = await client.get(
        f"/chats/{new_chat.id}/messages", headers=auth_header(token)
    )
    assert [
        (message["kind"], message["content"], message["model_id"])
        for message in stored.json()["items"]
    ] == [("request", "Hello", None), ("response", REPLY, MODEL_ID)]
    chats = await client.get("/chats", headers=auth_header(token))
    assert [chat["name"] for chat in chats.json()["items"]] == ["Hello"]


async def test_retry_failure_keeps_old_reply(
    client: AsyncClient, db_session: AsyncSession, token: str, new_chat: Chat
):
    await add_message(
        db_session, new_chat, ModelRequest(parts=[UserPromptPart("Hello")])
    )
    await add_message(
        db_session,
        new_chat,
        ModelResponse(parts=[TextPart("Old answer")]),
        model_id=MODEL_ID,
    )

    async def fail(
        _messages: list[ModelMessage], _info: AgentInfo
    ) -> AsyncIterator[str]:
        yield "Partial "
        raise ModelHTTPError(status_code=503, model_name="test")

    with agent.override(model=FunctionModel(stream_function=fail)):
        response = await retry_reply(client, token, chat_id=new_chat.id)

    assert response.status_code == 200
    chunks = await stream_chunks(response)
    [error] = [chunk for chunk in chunks if chunk["type"] == "error"]
    assert json.loads(error["errorText"])["detail"][0]["type"] == "llm.model_error"
    stored = await client.get(
        f"/chats/{new_chat.id}/messages", headers=auth_header(token)
    )
    assert [message["content"] for message in stored.json()["items"]] == [
        "Hello",
        "Old answer",
    ]


async def test_retry_empty_chat_has_nothing_to_retry(
    client: AsyncClient, token: str, new_chat: Chat
):
    response = await retry_reply(client, token, chat_id=new_chat.id)

    assert response.status_code == 409
    [error] = response.json()["detail"]
    assert error["type"] == "chat.nothing_to_retry"


@pytest.mark.parametrize(
    ("fields", "status", "error_type", "loc"),
    [
        pytest.param(
            {"model_id": "groq:missing"},
            404,
            "llm.model_not_found",
            ["body", "modelId"],
            id="unknown-model",
        ),
        pytest.param(
            {"model_id": "groq:text-only-model"},
            422,
            "chat.model_cannot_accept_files",
            ["body", "modelId"],
            id="files-on-text-only-model",
        ),
        pytest.param(
            {
                "messages": [
                    {
                        "id": "m1",
                        "role": "user",
                        "parts": [{"type": "text", "text": "Hi"}],
                    }
                ]
            },
            422,
            "too_long",
            ["body", "messages"],
            id="messages-sent",
        ),
    ],
)
async def test_retry_rejects_before_streaming(
    client: AsyncClient,
    s3: S3Client,
    db_session: AsyncSession,
    user: User,
    token: str,
    new_chat: Chat,
    fields: dict,
    status: int,
    error_type: str,
    loc: list[str],
):
    prompt = await add_message(
        db_session, new_chat, ModelRequest(parts=[UserPromptPart("See this")])
    )
    await store_attachment(s3, db_session, user_id=user.id, message_id=prompt.id)

    response = await retry_reply(client, token, chat_id=new_chat.id, **fields)

    assert response.status_code == status
    # Unpacking also checks that the error is not repeated.
    [error] = response.json()["detail"]
    assert error["type"] == error_type
    assert error["loc"] == loc


# Access


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        pytest.param("PATCH", "/chats/{id}/rename", {"name": "Mine now"}, id="rename"),
        pytest.param("GET", "/chats/{id}/messages", None, id="list-messages"),
        pytest.param(
            "POST",
            "/chats/{id}/retry",
            {"trigger": "regenerate-message", "id": "chat", "modelId": MODEL_ID},
            id="retry",
        ),
    ],
)
async def test_other_users_chat_is_not_found(
    client: AsyncClient,
    db_session: AsyncSession,
    other_user: User,
    token: str,
    method: str,
    path: str,
    body: dict | None,
):
    chat = await chat_service.create_chat(
        db_session, user_id=other_user.id, name="Their chat"
    )

    response = await client.request(
        method, path.format(id=chat.id), json=body, headers=auth_header(token)
    )

    assert response.status_code == 404
    assert response.json()["detail"][0]["type"] == "chat.chat_not_found"
