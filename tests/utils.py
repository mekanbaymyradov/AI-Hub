from httpx import AsyncClient, Response


async def sign_in(
    client: AsyncClient, sent_codes: dict[str, str], email: str
) -> Response:
    """Request a sign-in code and verify it, returning the verify response."""
    response = await client.post("/auth/otp/request", json={"email": email})
    assert response.status_code == 202

    return await client.post(
        "/auth/otp/verify", json={"email": email, "code": sent_codes[email]}
    )
