from pydantic import BaseModel


class ModelPublic(BaseModel):
    id: str
    display_name: str

class SendMessageRequest(BaseModel):
    prompt: str