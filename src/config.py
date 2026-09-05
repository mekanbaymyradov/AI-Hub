from functools import lru_cache
from typing import Literal

from pydantic import PostgresDsn, RedisDsn, SecretStr
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
    """Application settings."""

    project_title: str = "AI-Hub"
    app_version: str = "1.0"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    environment: Literal["local", "production"] = "local"
    debug: bool = False

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str
    postgres_password: SecretStr
    postgres_db: str

    database_engine_pool_size: int = 10
    database_engine_pool_timeout: int = 30
    database_engine_pool_recycle: int = 3600
    database_engine_pool_ping: bool = True
    database_engine_max_overflow: int = 10
    database_engine_echo: bool = False

    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: SecretStr | None = None
    redis_index: int = 0

    resend_api_key: SecretStr
    email_from: str = "onboarding@resend.dev"

    @property
    def database_uri(self) -> PostgresDsn:
        """
        Build database uri.
        """
        return PostgresDsn.build(
            scheme="postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password.get_secret_value(),
            host=self.postgres_host,
            port=self.postgres_port,
            path=self.postgres_db,
        )

    @property
    def redis_uri(self) -> RedisDsn:
        """
        Build redis uri.
        """
        password = (
            self.redis_password.get_secret_value() if self.redis_password else None
        )
        return RedisDsn.build(
            scheme="redis",
            password=password,
            host=self.redis_host,
            port=self.redis_port,
            path=str(self.redis_index),
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
