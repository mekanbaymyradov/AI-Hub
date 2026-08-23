from pydantic import BaseModel, ConfigDict

from src.enums import AIHubEnum


class ProviderKey(AIHubEnum):
    OPENAI = "openai"
    ANTROPIC = "antropic"
    GOOGLE = "google"


class ModelSpec(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    provider: ProviderKey
    model_name: str
    display_name: str


CATALOG: tuple[ModelSpec, ...] = (
    ModelSpec(
        id="google:gemini-3.6-flash",
        provider=ProviderKey.GOOGLE,
        model_name="gemini-3.6-flash",
        display_name="Gemini 3.6 Flash",
    ),
    ModelSpec(
        id="google:gemini-3.7-flash",
        provider=ProviderKey.GOOGLE,
        model_name="gemini-3.7-flash",
        display_name="Gemini 3.7 Flash",
    ),
    ModelSpec(
        id="anthropic:claude-sonnet-5",
        provider=ProviderKey.ANTHROPIC,
        model_name="claude-sonnet-5",
        display_name="Claude Sonnet 5",
    ),
    ModelSpec(
        id="openai:gpt-5.2",
        provider=ProviderKey.OPENAI,
        model_name="gpt-5.2",
        display_name="GPT-5.2",
    ),
)