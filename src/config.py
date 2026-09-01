from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class AppBaseSettings(BaseSettings):
    """Base settings every settings class inherits, loaded from .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,
    )


class Settings(AppBaseSettings):
    """Application-wide settings."""

    project_title: str = "AI-Hub"
    app_version: str = "1.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    environment: Literal["local", "production"] = "local"
    debug: bool = False


settings = Settings()
