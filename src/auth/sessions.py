"""Access tokens (stateless JWT) and refresh sessions (opaque, stored in Redis)."""

import hmac
import secrets
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import uuid4

import jwt
from redis.asyncio import Redis

from src.auth.config import auth_settings
from src.auth.exceptions import InvalidRefreshToken, NotAuthenticated


def session_key(sid: str) -> str:
    """Return the Redis key holding this session."""
    return f"session:{sid}"


def hash_token(raw_token: str) -> str:
    """Return the digest stored in place of a refresh token."""
    return sha256(raw_token.encode()).hexdigest()


def split_token(raw_token: str) -> str:
    """Pull the session id out of a refresh token.

    Raises:
        InvalidRefreshToken: The token is not in `{sid}.{secret}` form.
    """
    sid, separator, secret = raw_token.partition(".")
    if not separator or not sid or not secret:
        raise InvalidRefreshToken()
    return sid


def mint_access_token(*, user_id: int, sid: str) -> str:
    """Issue a short-lived JWT bound to this session."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "sid": sid,
        "jti": uuid4().hex,
        "iat": now,
        "exp": now + timedelta(seconds=auth_settings.access_token_ttl),
    }
    return jwt.encode(
        payload,
        auth_settings.jwt_secret.get_secret_value(),
        algorithm=auth_settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict:
    """Verify an access token and return its claims.

    Raises:
        NotAuthenticated: The token is malformed, expired or wrongly signed.
    """
    try:
        return jwt.decode(
            token,
            auth_settings.jwt_secret.get_secret_value(),
            algorithms=[auth_settings.jwt_algorithm],
            leeway=10,
        )
    except jwt.InvalidTokenError as exc:
        raise NotAuthenticated() from exc


async def _write_session(
    redis: Redis, *, sid: str, user_id: int, created_at: str
) -> str:
    """Store a freshly issued refresh token for this session and return it."""
    raw_token = f"{sid}.{secrets.token_urlsafe(32)}"

    pipe = redis.pipeline()
    pipe.hset(
        session_key(sid),
        mapping={
            "user_id": user_id,
            "token_hash": hash_token(raw_token),
            "created_at": created_at,
            "last_used_at": datetime.now(UTC).isoformat(),
        },
    )
    pipe.expire(session_key(sid), auth_settings.refresh_token_ttl)
    await pipe.execute()

    return raw_token


async def create_session(redis: Redis, *, user_id: int) -> tuple[str, str]:
    """Open a session and return its access and refresh tokens."""
    sid = uuid4().hex
    raw_token = await _write_session(
        redis, sid=sid, user_id=user_id, created_at=datetime.now(UTC).isoformat()
    )
    return mint_access_token(user_id=user_id, sid=sid), raw_token


async def rotate_session(redis: Redis, *, raw_token: str) -> tuple[str, str]:
    """Exchange a refresh token for a new pair, sliding the session's expiry.

    A token that does not match the stored hash was valid once and has since been
    rotated, which means it was replayed. The whole session is dropped.

    Raises:
        InvalidRefreshToken: The session is gone, or the token was replayed.
    """
    sid = split_token(raw_token)
    stored = await redis.hgetall(session_key(sid))
    if not stored:
        raise InvalidRefreshToken()

    if not hmac.compare_digest(stored["token_hash"], hash_token(raw_token)):
        await redis.delete(session_key(sid))
        raise InvalidRefreshToken()

    user_id = int(stored["user_id"])
    new_token = await _write_session(
        redis, sid=sid, user_id=user_id, created_at=stored["created_at"]
    )
    return mint_access_token(user_id=user_id, sid=sid), new_token


async def revoke_session(redis: Redis, *, raw_token: str) -> None:
    """Close the session this refresh token belongs to."""
    await redis.delete(session_key(split_token(raw_token)))
