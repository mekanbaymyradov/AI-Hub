from typing import Any

import pytest
from httpx2 import AsyncClient
from logfire.testing import CaptureLogfire

from src.auth.constants import INSTRUCTIONS_MAX_LENGTH
from src.auth.models import User
from src.config import settings
from tests.utils import auth_header, request_code, verify_code

pytestmark = pytest.mark.anyio


def request_span_attributes(capfire: CaptureLogfire, name: str) -> dict[str, Any]:
    """Return the attributes of the request span named like "POST /auth/otp/verify"."""
    spans = capfire.exporter.exported_spans_as_dict(parse_json_attributes=True)
    return next(span["attributes"] for span in spans if span["name"] == name)


async def test_production_request_span_records_no_input(
    client: AsyncClient,
    sent_codes: dict[str, str],
    user: User,
    capfire: CaptureLogfire,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "environment", "production")
    code = await request_code(client, sent_codes, user.email)

    response = await verify_code(client, user.email, code)

    assert response.status_code == 200
    attributes = request_span_attributes(capfire, "POST /auth/otp/verify")
    assert code not in str(attributes)
    assert user.email not in str(attributes)


async def test_production_request_span_drops_rejected_input(
    client: AsyncClient,
    token: str,
    capfire: CaptureLogfire,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "environment", "production")
    instructions = "a" * (INSTRUCTIONS_MAX_LENGTH + 1)

    response = await client.patch(
        "/auth/me", json={"instructions": instructions}, headers=auth_header(token)
    )

    assert response.status_code == 422
    attributes = request_span_attributes(capfire, "PATCH /auth/me")
    errors = attributes["fastapi.arguments.errors"]
    assert errors
    assert all("input" not in error for error in errors)
    assert instructions not in str(attributes)


async def test_request_span_records_user_id(
    client: AsyncClient, user: User, token: str, capfire: CaptureLogfire
):
    response = await client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    attributes = request_span_attributes(capfire, "GET /auth/me")
    assert attributes["user_id"] == user.id


async def test_local_request_span_records_only_client_input(
    client: AsyncClient, sent_codes: dict[str, str], capfire: CaptureLogfire
):
    await request_code(client, sent_codes, "new@example.com")

    attributes = request_span_attributes(capfire, "POST /auth/otp/request")
    assert attributes["fastapi.arguments.values"] == {
        "payload": {"email": "new@example.com"}
    }
