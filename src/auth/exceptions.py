from src.exceptions import AppError, UnauthorizedError


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


class UnsupportedImageType(AppError):
    status = 415
    type = "auth.unsupported_image_type"
    msg = "Avatar must be a WebP image."


class AvatarTooLarge(AppError):
    status = 413
    type = "auth.avatar_too_large"
    msg = "Avatar is too large."
