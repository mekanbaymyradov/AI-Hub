import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import otp, service
from tests.utils import auth_header, request_code, sign_in, verify_code

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
