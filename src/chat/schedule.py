import asyncio
from datetime import UTC, datetime, timedelta

import logfire
from fastapi.concurrency import iterate_in_threadpool
from mypy_boto3_s3 import S3Client
from sqlalchemy.ext.asyncio import AsyncSession

from src.chat import flows, service
from src.chat.config import chat_settings
from src.chat.constants import ATTACHMENT_MAX_BATCH_SIZE
from src.jobs import run_job
from src.storage import create_storage_client


async def delete_unclaimed_attachments(
    db: AsyncSession, storage: S3Client, *, older_than: timedelta
) -> int:
    deleted = 0
    while True:
        keys = await service.delete_unclaimed_attachments(
            db, older_than=older_than, limit=ATTACHMENT_MAX_BATCH_SIZE
        )
        # Rows go first: dropping a file first could lose one a message claims
        # meanwhile, while a failed file delete only leaves a stray for the sweep.
        await db.commit()
        if keys:
            await flows.delete_attachment_objects(storage, keys=keys)
        deleted += len(keys)
        if len(keys) < ATTACHMENT_MAX_BATCH_SIZE:
            return deleted


async def delete_stray_objects(
    db: AsyncSession, storage: S3Client, *, older_than: timedelta
) -> int:
    """Delete attachment files with no row, sparing ones newer than `older_than`.

    New files are spared because an upload stores its file before its row commits.
    """
    cutoff = datetime.now(UTC) - older_than
    paginator = storage.get_paginator("list_objects_v2")
    pages = paginator.paginate(
        Bucket=chat_settings.s3_private_bucket,
        Prefix="attachments/",
        PaginationConfig={"PageSize": ATTACHMENT_MAX_BATCH_SIZE},
    )
    deleted = 0
    async for page in iterate_in_threadpool(pages):
        keys = [
            obj["Key"]
            for obj in page.get("Contents", [])
            if obj["LastModified"] < cutoff
        ]
        if not keys:
            continue
        known = await service.get_attachment_keys_by_keys(db, keys=keys)
        stray = [key for key in keys if key not in known]
        if stray:
            await flows.delete_attachment_objects(storage, keys=stray)
            deleted += len(stray)
    return deleted


async def cleanup_attachments(db: AsyncSession) -> None:
    older_than = timedelta(seconds=chat_settings.attachment_unclaimed_ttl)
    storage = create_storage_client()
    try:
        unclaimed = await delete_unclaimed_attachments(
            db, storage, older_than=older_than
        )
        stray = await delete_stray_objects(db, storage, older_than=older_than)
    finally:
        storage.close()

    logfire.info(
        "Attachment cleanup done: {unclaimed} unclaimed, {stray} stray",
        unclaimed=unclaimed,
        stray=stray,
    )


if __name__ == "__main__":
    asyncio.run(run_job("attachments_cleanup", cleanup_attachments))
