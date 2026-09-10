from typing import Annotated

import boto3
from botocore.config import Config
from fastapi import Depends, Request
from mypy_boto3_s3 import S3Client

from src.config import settings


def create_storage_client() -> S3Client:
    """Create the S3 client shared by every request."""
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id.get_secret_value(),
        aws_secret_access_key=settings.s3_secret_access_key.get_secret_value(),
        region_name=settings.s3_region,
        # R2 serves the bucket under its account endpoint, so address it path-style.
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


async def get_storage(request: Request) -> S3Client:
    """Return the client built during the app's lifespan."""
    return request.state.storage


StorageDep = Annotated[S3Client, Depends(get_storage)]


def public_url(key: str) -> str:
    """Build the publicly served URL of a stored object."""
    return f"{settings.s3_public_base_url.rstrip('/')}/{key}"


def presigned_url(client: S3Client, *, bucket: str, key: str, expires_in: int) -> str:
    """Sign a time-limited GET URL for an object in a private bucket.

    Unlike the calls that reach S3, signing is local HMAC, so it needs no threadpool.
    """
    return client.generate_presigned_url(
        "get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=expires_in
    )
