from src.exceptions import (
    AppError,
    ContentTooLargeError,
    UnauthorizedError,
    UnsupportedMediaTypeError,
)


class InvalidOTP(UnauthorizedError):
    type = "auth.invalid_otp"
    msg = "Invalid or expired code."


class OTPAttemptsExceeded(AppError):
    status = 429
    type = "auth.otp_attempts_exceeded"
    msg = "Too many attempts. Request a new code."


class InvalidRefreshToken(UnauthorizedError):
    type = "auth.invalid_refresh_token"
    msg = "Invalid refresh token."


class NotAuthenticated(UnauthorizedError):
    type = "auth.not_authenticated"
    msg = "Not authenticated."


class UnsupportedImageType(UnsupportedMediaTypeError):
    type = "auth.unsupported_image_type"
    msg = "Unsupported image type."


class AvatarTooLarge(ContentTooLargeError):
    type = "auth.avatar_too_large"
    msg = "Avatar is too large."
