from pydantic_settings import BaseSettings, SettingsConfigDict

from typing import Literal

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore"
    )

    project_title: str = "AI-Hub"
    app_version: str = '1.0'
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    environment: Literal["local", "staging", "production"] = "local"
    debug: bool = False


settings = Settings()