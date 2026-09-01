from pydantic import BaseModel


class ModelPublic(BaseModel):
    """A model as returned by the API."""

    id: str
    display_name: str


class SendMessageRequest(BaseModel):
    """A prompt sent to a model."""

    prompt: str
