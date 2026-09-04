from pydantic import BaseModel, EmailStr, Field


class OTPRequest(BaseModel):
    """The address a one-time code should be sent to."""

    email: EmailStr


class OTPVerify(BaseModel):
    """A one-time code submitted for an address."""

    email: EmailStr
    code: str


class RefreshRequest(BaseModel):
    """A refresh token sent in the body by clients that do not use cookies."""

    refresh_token: str | None = None


class TokenPair(BaseModel):
    """The tokens issued after a successful login or refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserPublic(BaseModel):
    """A user as returned by the API."""

    id: int
    email: str
    name: str


class UserUpdate(BaseModel):
    """The editable fields of a user profile."""

    name: str = Field(min_length=1, max_length=50)
