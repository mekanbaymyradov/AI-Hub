import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.auth import otp, service
from tests.utils import sign_in

pytestmark = pytest.mark.anyio


@pytest.fixture
def sent_codes(monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """Sign-in codes the app tried to email, keyed by address."""
    codes: dict[str, str] = {}

    async def fake_send_otp_email(email, code, **kwargs):
        codes[email] = code

    monkeypatch.setattr(otp, "send_otp_email", fake_send_otp_email)
    return codes


async def test_new_user_is_created(
    client: AsyncClient, db_session: AsyncSession, sent_codes: dict[str, str]
):
    response = await sign_in(client, sent_codes, "new@example.com")

    assert response.status_code == 200
    user = await service.get_user_by_email(db_session, email="new@example.com")
    assert user is not None


async def test_existing_user_logs_in(
    client: AsyncClient, db_session: AsyncSession, sent_codes: dict[str, str]
):
    await service.create_user(db_session, email="user@example.com")

    response = await sign_in(client, sent_codes, "user@example.com")

    assert response.status_code == 200
    assert response.json()["access_token"]
    assert "refresh_token" in client.cookies
