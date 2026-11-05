from pydantic import BaseModel, Field


class TranscriptionResponse(BaseModel):
    text: str = Field(description="What was said, in the language it was said in.")
