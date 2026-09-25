from pydantic import SecretStr

from src.config import AppBaseSettings


class LLMSettings(AppBaseSettings):
    """Provider API keys. A provider without a key is left out of the registry."""

    anthropic_api_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None
    google_api_key: SecretStr | None = None
    groq_api_key: SecretStr | None = None


llm_settings = LLMSettings()
