import pytest
from httpx import AsyncClient
from mypy_boto3_s3 import S3Client
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import otp, service
from src.auth.config import auth_settings
from src.auth.constants import INSTRUCTIONS_MAX_LENGTH
from src.config import settings
from tests.utils import (
    auth_header,
    request_code,
    sign_in,
    stored_avatar_keys,
    upload_avatar,
    verify_code,
)

pytestmark = pytest.mark.anyio

WRONG_OTP_CODE = "wrong-code"
WRONG_ACCESS_TOKEN = "wrong-jwt"
REFRESH_COOKIE = "refresh_token"


@pytest.fixture(autouse=True)
def sent_codes(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """Sign-in codes the app tried to email, keyed by address."""
    codes: dict[str, str] = {}

    async def fake_send_otp_email(email, code, **kwargs):
        codes[email] = code

    monkeypatch.setattr(otp, "send_otp_email", fake_send_otp_email)
    return codes


# Sign-in


async def test_new_user_is_created(
    client: AsyncClient, db_session: AsyncSession, sent_codes: dict[str, str]
):
    email = "new@example.com"
    code = await request_code(client, sent_codes, email)

    response = await verify_code(client, email, code)

    assert response.status_code == 200
    user = await service.get_user_by_email(db_session, email=email)
    assert user is not None


async def test_existing_user_logs_in(
    client: AsyncClient, db_session: AsyncSession, sent_codes: dict[str, str]
):
    email = "user@example.com"
    await service.create_user(db_session, email=email)
    code = await request_code(client, sent_codes, email)

    response = await verify_code(client, email, code)

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert REFRESH_COOKIE in client.cookies


async def test_wrong_otp_code_fails(client: AsyncClient, sent_codes: dict[str, str]):
    email = "user@example.com"
    await request_code(client, sent_codes, email)

    response = await verify_code(client, email, WRONG_OTP_CODE)

    assert response.status_code == 401
    assert response.json()["detail"][0]["type"] == "auth.invalid_otp"


async def test_too_many_wrong_otp_attempts_invalidates_code(
    client: AsyncClient, sent_codes: dict[str, str]
):
    email = "user@example.com"
    code = await request_code(client, sent_codes, email)
    for _ in range(4):
        await verify_code(client, email, WRONG_OTP_CODE)

    response = await verify_code(client, email, WRONG_OTP_CODE)

    assert response.status_code == 429
    assert response.json()["detail"][0]["type"] == "auth.otp_attempts_exceeded"
    response = await verify_code(client, email, code)
    assert response.status_code == 401


async def test_otp_code_works_only_once(
    client: AsyncClient, sent_codes: dict[str, str]
):
    email = "user@example.com"
    code = await request_code(client, sent_codes, email)
    first = await verify_code(client, email, code)
    assert first.status_code == 200

    response = await verify_code(client, email, code)

    assert response.status_code == 401
    assert response.json()["detail"][0]["type"] == "auth.invalid_otp"


async def test_otp_request_is_rate_limited(
    client: AsyncClient, sent_codes: dict[str, str]
):
    email = "user@example.com"
    for _ in range(5):
        await request_code(client, sent_codes, email)

    response = await client.post("/auth/otp/request", json={"email": email})

    assert response.status_code == 429
    assert response.json()["detail"][0]["type"] == "rate_limit"
    assert "retry-after" in response.headers


# Sessions


async def test_refresh_rotates_refresh_token(
    client: AsyncClient, sent_codes: dict[str, str]
):
    await sign_in(client, sent_codes, "user@example.com")
    old_refresh_token = client.cookies[REFRESH_COOKIE]

    response = await client.post("/auth/token/refresh")

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert client.cookies[REFRESH_COOKIE] != old_refresh_token


async def test_reused_refresh_token_revokes_session(
    client: AsyncClient, sent_codes: dict[str, str]
):
    await sign_in(client, sent_codes, "user@example.com")
    old_refresh_token = client.cookies[REFRESH_COOKIE]
    first = await client.post("/auth/token/refresh")
    assert first.status_code == 200

    response = await client.post(
        "/auth/token/refresh",
        headers={"Cookie": f"{REFRESH_COOKIE}={old_refresh_token}"},
    )

    assert response.status_code == 401
    assert response.json()["detail"][0]["type"] == "auth.invalid_refresh_token"
    response = await client.post("/auth/token/refresh")  # jar still holds the new token
    assert response.status_code == 401


async def test_logout_revokes_session(client: AsyncClient, sent_codes: dict[str, str]):
    await sign_in(client, sent_codes, "user@example.com")
    refresh_token = client.cookies[REFRESH_COOKIE]

    response = await client.post("/auth/logout")

    assert response.status_code == 204
    assert REFRESH_COOKIE not in client.cookies
    response = await client.post(
        "/auth/token/refresh",
        headers={"Cookie": f"{REFRESH_COOKIE}={refresh_token}"},
    )
    assert response.status_code == 401


# Current user


async def test_me_returns_signed_in_user(
    client: AsyncClient, sent_codes: dict[str, str]
):
    email = "user@example.com"
    token = await sign_in(client, sent_codes, email)

    response = await client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["email"] == email
    assert response.json()["avatar_initial"] == "U"


async def test_me_without_token_is_rejected(client: AsyncClient):
    response = await client.get("/auth/me")

    assert response.status_code == 401
    assert response.json()["detail"][0]["type"] == "auth.not_authenticated"


async def test_me_with_invalid_token_is_rejected(client: AsyncClient):
    response = await client.get("/auth/me", headers=auth_header(WRONG_ACCESS_TOKEN))

    assert response.status_code == 401
    assert response.json()["detail"][0]["type"] == "auth.not_authenticated"


async def test_update_profile_changes_name(
    client: AsyncClient, sent_codes: dict[str, str]
):
    token = await sign_in(client, sent_codes, "user@example.com")

    response = await client.patch(
        "/auth/me", json={"name": "Alice"}, headers=auth_header(token)
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Alice"


async def test_update_profile_sets_instructions(
    client: AsyncClient, sent_codes: dict[str, str]
):
    token = await sign_in(client, sent_codes, "user@example.com")
    await client.patch("/auth/me", json={"name": "Alice"}, headers=auth_header(token))

    response = await client.patch(
        "/auth/me",
        json={"instructions": "Answer in Turkmen."},
        headers=auth_header(token),
    )

    assert response.status_code == 200
    me = await client.get("/auth/me", headers=auth_header(token))
    assert me.json()["instructions"] == "Answer in Turkmen."
    assert me.json()["name"] == "Alice"


async def test_update_profile_clears_instructions(
    client: AsyncClient, sent_codes: dict[str, str]
):
    token = await sign_in(client, sent_codes, "user@example.com")
    await client.patch(
        "/auth/me", json={"instructions": "Be brief."}, headers=auth_header(token)
    )

    response = await client.patch(
        "/auth/me", json={"instructions": None}, headers=auth_header(token)
    )

    assert response.status_code == 200
    assert response.json()["instructions"] is None


async def test_update_profile_stores_blank_instructions_as_null(
    client: AsyncClient, sent_codes: dict[str, str]
):
    token = await sign_in(client, sent_codes, "user@example.com")

    response = await client.patch(
        "/auth/me", json={"instructions": "   \n "}, headers=auth_header(token)
    )

    assert response.status_code == 200
    assert response.json()["instructions"] is None


async def test_update_profile_rejects_too_long_instructions(
    client: AsyncClient, sent_codes: dict[str, str]
):
    token = await sign_in(client, sent_codes, "user@example.com")

    response = await client.patch(
        "/auth/me",
        json={"instructions": "a" * (INSTRUCTIONS_MAX_LENGTH + 1)},
        headers=auth_header(token),
    )

    assert response.status_code == 422


async def test_upload_avatar_stores_image(
    client: AsyncClient, s3: S3Client, sent_codes: dict[str, str]
):
    token = await sign_in(client, sent_codes, "user@example.com")

    response = await upload_avatar(client, token)

    assert response.status_code == 200
    keys = stored_avatar_keys(s3)
    assert len(keys) == 1
    assert response.json()["avatar_url"].endswith(keys[0])
    stored = s3.head_object(Bucket=settings.s3_public_bucket, Key=keys[0])
    assert stored["ContentType"] == "image/webp"


async def test_upload_avatar_rejects_non_webp(
    client: AsyncClient, s3: S3Client, sent_codes: dict[str, str]
):
    token = await sign_in(client, sent_codes, "user@example.com")

    response = await upload_avatar(client, token, content_type="image/png")

    assert response.status_code == 415
    assert response.json()["detail"][0]["type"] == "auth.unsupported_image_type"
    assert stored_avatar_keys(s3) == []


async def test_upload_avatar_rejects_too_large(
    client: AsyncClient,
    s3: S3Client,
    sent_codes: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(auth_settings, "avatar_max_bytes", 10)
    token = await sign_in(client, sent_codes, "user@example.com")

    response = await upload_avatar(client, token, content=b"x" * 11)

    assert response.status_code == 413
    assert response.json()["detail"][0]["type"] == "auth.avatar_too_large"
    assert stored_avatar_keys(s3) == []


async def test_replacing_avatar_keeps_only_new_image(
    client: AsyncClient, s3: S3Client, sent_codes: dict[str, str]
):
    token = await sign_in(client, sent_codes, "user@example.com")
    first = await upload_avatar(client, token)
    assert first.status_code == 200

    response = await upload_avatar(client, token)

    assert response.status_code == 200
    keys = stored_avatar_keys(s3)
    assert len(keys) == 1
    assert response.json()["avatar_url"].endswith(keys[0])


async def test_delete_avatar_removes_image(
    client: AsyncClient, s3: S3Client, sent_codes: dict[str, str]
):
    token = await sign_in(client, sent_codes, "user@example.com")
    uploaded = await upload_avatar(client, token)
    assert uploaded.status_code == 200

    response = await client.delete("/auth/me/avatar", headers=auth_header(token))

    assert response.status_code == 204
    assert stored_avatar_keys(s3) == []
    me = await client.get("/auth/me", headers=auth_header(token))
    assert me.json()["avatar_url"] is None
