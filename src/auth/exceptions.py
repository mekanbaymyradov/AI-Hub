from src.exceptions import AppError, UnauthorizedError


class InvalidOTP(UnauthorizedError):
    """The submitted code does not match the one that was issued."""

    type = "auth.invalid_otp"
    msg = "Invalid or expired code."


class OTPAttemptsExceeded(AppError):
    """Too many wrong codes were submitted, so the code was discarded."""

    status = 429
    type = "auth.otp_attempts_exceeded"
    msg = "Too many attempts. Request a new code."


class InvalidRefreshToken(UnauthorizedError):
    """The refresh token is unknown, malformed or already rotated."""

    type = "auth.invalid_refresh_token"
    msg = "Invalid refresh token."


class NotAuthenticated(UnauthorizedError):
    """The access token is missing, malformed or expired."""

    type = "auth.not_authenticated"
    msg = "Not authenticated."
