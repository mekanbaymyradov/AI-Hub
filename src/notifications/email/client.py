"""Transport for outgoing email. Knows Resend, knows nothing about the domains using it."""

import httpx

from src.config import settings

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(
    *, to: str, template: str, variables: dict[str, str | int]
) -> None:
    """Send one templated email through Resend, raising on a non-2xx response.

    The subject comes from the template's defaults, so it is not sent here.

    Args:
        to: Recipient address
        template: Id or published alias of a Resend template
        variables: Values substituted into the template. The project title is
            added here, so templates can name the product. Omitted keys fall
            back to the defaults declared on the template.
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
                "template": {
                    "id": template,
                    "variables": {
                        "PROJECT_TITLE": settings.project_title,
                        **variables,
                    },
                },
            },
        )
        response.raise_for_status()
