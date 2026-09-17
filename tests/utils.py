from httpx import AsyncClient, Response


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
