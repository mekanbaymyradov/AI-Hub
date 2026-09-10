from src.exceptions import AppError, NotFoundError


class ChatNotFound(NotFoundError):
    """The chat does not exist, or belongs to another user."""

    type = "chat.chat_not_found"
    msg = "Chat not found."


class AttachmentNotFound(NotFoundError):
    """The attachment does not exist, belongs to another user, or is already sent.

    All three are one error so a caller cannot probe for another user's ids.
    """

    type = "chat.attachment_not_found"
    msg = "Attachment not found."


class AttachmentTooLarge(AppError):
    status = 413
    type = "chat.attachment_too_large"
    msg = "Attachment is too large."


class UnsupportedAttachmentType(AppError):
    status = 415
    type = "chat.unsupported_attachment_type"
    msg = "Attachment must be an image or a PDF."


class TooManyAttachments(AppError):
    status = 422
    type = "chat.too_many_attachments"
    msg = "Too many attachments."


class ModelCannotAcceptFiles(AppError):
    status = 422
    type = "chat.model_cannot_accept_files"
    msg = "This model does not accept attachments."
