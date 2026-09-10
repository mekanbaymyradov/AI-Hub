from src.config import AppBaseSettings


class ChatSettings(AppBaseSettings):
    """Attachment limits and the private bucket holding them.

    Attachments live in their own bucket because R2 serves public access per
    bucket, so keeping them out of the one avatars are served from is what
    makes them private.
    """

    s3_private_bucket: str
    attachment_max_bytes: int = 10_485_760  # 10 MiB
    attachment_max_count: int = 5
    attachment_url_ttl: int = 900  # 15 minutes


chat_settings = ChatSettings()
