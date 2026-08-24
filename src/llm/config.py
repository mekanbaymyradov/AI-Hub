from pydantic import SecretStr

from src.config import AIHubBaseSettings


class LLMSettings(AIHubBaseSettings):
    anthropic_api_key: SecretStr | None = None
    openai_api_key: SecretStr | None = None
    google_api_key: SecretStr | None = None


llm_settings = LLMSettings()