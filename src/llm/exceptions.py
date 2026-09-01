from src.exceptions import NotFoundError


class ModelNotFound(NotFoundError):
    """The requested model id is not available."""

    type = "llm.model_not_found"
    msg = "Model not found."
