from httpx import AsyncClient, Response
from mypy_boto3_s3 import S3Client

from src.config import settings


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
