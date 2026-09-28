CHAT_NAME_LENGTH = 60

ALLOWED_MEDIA_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
)

ATTACHMENT_MAX_BATCH_SIZE = 1000  # S3 DeleteObjects takes at most 1000 keys
