from src.exceptions import NotFoundError


class ChatNotFound(NotFoundError):
    """The chat does not exist, or belongs to another user."""

    type = "chat.chat_not_found"
    msg = "Chat not found."
