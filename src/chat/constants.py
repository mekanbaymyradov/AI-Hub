CHAT_NAME_LENGTH = 60
NEW_CHAT_NAME = "New chat"  # until the first reply titles the chat

# The AI SDK major the frontend runs; the stream's chunks must match it.
VERCEL_AI_SDK_VERSION = 6

ALLOWED_MEDIA_TYPES = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
)

ATTACHMENT_MAX_BATCH_SIZE = 1000  # S3 DeleteObjects takes at most 1000 keys
