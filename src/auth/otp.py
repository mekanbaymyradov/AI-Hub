"""One-time codes: issued into Redis with a TTL, delivered over email."""

import hmac
import secrets
from hashlib import sha256

from redis.asyncio import Redis

from src.auth.config import auth_settings
from src.auth.exceptions import InvalidOTP, OTPAttemptsExceeded
from src.notifications import send_email

SUBJECT = "Your AI-Hub sign-in code"


def otp_key(email: str) -> str:
    """Return the Redis key holding the code issued for this address."""
    return f"otp:email:{email}"


def hash_code(code: str) -> str:
    """Return the HMAC of a code, so a Redis dump never exposes a live one."""
    return hmac.new(
        auth_settings.jwt_secret.get_secret_value().encode(),
        code.encode(),
        sha256,
    ).hexdigest()


async def issue_otp(redis: Redis, *, email: str) -> str:
    """Generate a code for this address, store its hash, and return the code."""
    code = f"{secrets.randbelow(10**auth_settings.otp_length):0{auth_settings.otp_length}d}"
    key = otp_key(email)

    pipe = redis.pipeline()
    pipe.delete(key)
    pipe.hset(key, mapping={"code_hash": hash_code(code), "attempts": 0})
    pipe.expire(key, auth_settings.otp_ttl)
    await pipe.execute()

    return code


async def verify_otp(redis: Redis, *, email: str, code: str) -> None:
    """Check a code, consuming it on success.

    Raises:
        InvalidOTP: No code is outstanding for this address, or the code is wrong.
        OTPAttemptsExceeded: The attempt limit was reached, so the code was discarded.
    """
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


async def send_otp_email(email: str, code: str) -> None:
    """Compose and deliver the sign-in code."""
    minutes = auth_settings.otp_ttl // 60
    html = (
        f"<p>Your AI-Hub sign-in code is <strong>{code}</strong>.</p>"
        f"<p>It expires in {minutes} minutes.</p>"
    )
    await send_email(to=email, subject=SUBJECT, html=html)
