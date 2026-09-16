import hmac
import secrets
from hashlib import sha256

from redis.asyncio import Redis

from src.auth.config import auth_settings
from src.auth.exceptions import InvalidOTP, OTPAttemptsExceeded
from src.notifications.email import send_email, templates


def otp_key(email: str) -> str:
    return f"otp:email:{email}"


def hash_code(code: str) -> str:
    return hmac.new(
        auth_settings.jwt_secret.get_secret_value().encode(),
        code.encode(),
        sha256,
    ).hexdigest()


async def issue_otp(redis: Redis, *, email: str) -> str:
    n = auth_settings.otp_length
    code = f"{secrets.randbelow(10**n):0{n}d}"
    key = otp_key(email)

    pipe = redis.pipeline()
    pipe.delete(key)
    pipe.hset(key, mapping={"code_hash": hash_code(code), "attempts": 0})
    pipe.expire(key, auth_settings.otp_ttl)
    await pipe.execute()

    return code


async def verify_otp(redis: Redis, *, email: str, code: str) -> None:
    key = otp_key(email)
    stored = await redis.hget(key, "code_hash")
    if stored is None:
        raise InvalidOTP(loc=["body", "code"])

    if hmac.compare_digest(stored, hash_code(code)):
        await redis.delete(key)
        return

    attempts = await redis.hincrby(key, "attempts", 1)
    if attempts >= auth_settings.otp_max_attempts:
        await redis.delete(key)
        raise OTPAttemptsExceeded(loc=["body", "code"])

    raise InvalidOTP(loc=["body", "code"])


async def send_otp_email(
    email: str, code: str, *, name: str | None, is_new_user: bool
) -> None:
    variables: dict[str, str | int] = {
        "CODE": code,
        "EXPIRES_MINUTES": auth_settings.otp_ttl // 60,
    }
    # Omitted keys fall back to the template's default, so an unnamed user needs
    # no separate greeting here. "USER_NAME" avoids Resend's reserved names.
    if name:
        variables["USER_NAME"] = name

    await send_email(
        to=email,
        template=templates.OTP_WELCOME if is_new_user else templates.OTP_SIGNIN,
        variables=variables,
    )
