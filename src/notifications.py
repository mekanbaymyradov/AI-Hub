"""Transport for outgoing messages. Knows Resend, knows nothing about the domains using it."""

import httpx

from src.config import settings

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str) -> None:
    """Send one email through Resend, raising on a non-2xx response.

    Args:
        to: Recipient address
        subject: Subject line
        html: Message body as HTML
    """
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            RESEND_API_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key.get_secret_value()}"
            },
            json={
                "from": settings.email_from,
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        response.raise_for_status()
