from src.exceptions import AppError, NotFoundError


class ModelNotFound(NotFoundError):
    """The requested model id is not available."""

    type = "llm.model_not_found"
    msg = "Model not found."


class ModelError(AppError):
    """The model's provider failed or refused to produce a reply."""

    status = 502
    type = "llm.model_error"
    msg = "The model failed to reply."
