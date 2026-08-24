from pydantic import BaseModel


class ModelPublic(BaseModel):
    id: str
    display_name: str

class SendMessageRequest(BaseModel):
    model_id: str
    prompt: str

class SendMessageResponse(BaseModel):
    output: str