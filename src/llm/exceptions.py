from src.exceptions import NotFoundError


class ModelNotFound(NotFoundError):
    type = "llm.model_not_found"
    msg = "Model not found."

