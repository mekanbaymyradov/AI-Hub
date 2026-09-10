from pydantic import BaseModel, ConfigDict, computed_field

from src.llm.enums import Provider


class ModelSpec(BaseModel):
    """A model offered by the app and the provider serving it."""

    model_config = ConfigDict(frozen=True)

    provider: Provider
    model_name: str
    display_name: str
    supports_files: bool = True
    """Whether the model accepts image and PDF attachments."""

    @computed_field
    @property
    def id(self) -> str:
        return f"{self.provider}:{self.model_name}"


CATALOG: tuple[ModelSpec, ...] = (
    ModelSpec(
        provider=Provider.ANTHROPIC,
        model_name="claude-sonnet-5",
        display_name="Claude Sonnet 5",
    ),
    ModelSpec(
        provider=Provider.OPENAI,
        model_name="gpt-5.2",
        display_name="GPT-5.2",
    ),
    ModelSpec(
        provider=Provider.GOOGLE,
        model_name="gemini-3.6-flash",
        display_name="Gemini 3.6 Flash",
    ),
    ModelSpec(
        provider=Provider.GOOGLE,
        model_name="gemini-3.7-flash",
        display_name="Gemini 3.7 Flash",
    ),
)


class ModelPublic(BaseModel):
    """A model as returned by the API."""

    id: str
    display_name: str