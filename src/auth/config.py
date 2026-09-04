from pydantic import SecretStr

from src.config import AppBaseSettings


class AuthSettings(AppBaseSettings):
    """Token and one-time-code parameters."""

    jwt_secret: SecretStr
    jwt_algorithm: str = "HS256"
    access_token_ttl: int = 900  # 15 minutes
    refresh_token_ttl: int = 2592000  # 30 days
    otp_ttl: int = 300  # 5 minutes
    otp_length: int = 6
    otp_max_attempts: int = 5


auth_settings = AuthSettings()
