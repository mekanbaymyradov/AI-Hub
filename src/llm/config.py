from pydantic import SecretStr

from src.config import AIHubBaseSettings


class LLMSettings(AIHubBaseSettings):
    google_api_key: SecretStr
    openai_api_key: SecretStr
    antropic_api_key: SecretStr
    


