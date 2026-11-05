import httpx2
import pytest
from httpx2 import AsyncClient, Response

from src.http_client import get_http_client
from src.llm.config import llm_settings
from src.main import app
from src.voice.config import voice_settings
from tests.utils import auth_header

pytestmark = pytest.mark.anyio


TRANSCRIPT = "Hi. How are you?"


def transcribed() -> httpx2.Response:
    return httpx2.Response(200, json={"text": TRANSCRIPT})


def fake_groq(answer: httpx2.Response | httpx2.HTTPError) -> list[httpx2.Request]:
    """Make Groq answer every request with `answer`, returning the requests it gets.

    Needs the `client` fixture, which clears the override afterwards.
    """
    requests: list[httpx2.Request] = []

    def handle(request: httpx2.Request) -> httpx2.Response:
        requests.append(request)
        if isinstance(answer, httpx2.HTTPError):
            raise answer
        return answer

    http = httpx2.AsyncClient(transport=httpx2.MockTransport(handle))
    app.dependency_overrides[get_http_client] = lambda: http
    return requests


async def transcribe(
    client: AsyncClient,
    token: str | None,
    *,
    content: bytes = b"fake-audio",
    content_type: str = "audio/webm",
) -> Response:
    return await client.post(
        "/voice/transcriptions",
        headers=auth_header(token) if token else {},
        # Browsers name a recording "blob", with no extension.
        files={"file": ("blob", content, content_type)},
    )


async def test_transcribe_returns_text(client: AsyncClient, token: str):
    requests = fake_groq(transcribed())

    response = await transcribe(client, token, content_type="audio/webm;codecs=opus")

    assert response.status_code == 200
    assert response.json() == {"text": TRANSCRIPT}
    [request] = requests
    assert request.headers["Authorization"] == "Bearer test"
    assert b'name="model"\r\n\r\nwhisper-large-v3-turbo\r\n' in request.content
    assert b'filename="audio.webm"' in request.content
    assert b"Content-Type: audio/webm\r\n" in request.content


async def test_transcribe_rejects_unsupported_type(client: AsyncClient, token: str):
    requests = fake_groq(transcribed())

    response = await transcribe(client, token, content_type="text/plain")

    assert response.status_code == 415
    error = response.json()["detail"][0]
    assert error["type"] == "voice.unsupported_audio_type"
    assert error["loc"] == ["body", "file"]
    assert requests == []


async def test_transcribe_rejects_too_large(
    client: AsyncClient, token: str, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(voice_settings, "transcription_max_bytes", 10)
    requests = fake_groq(transcribed())

    response = await transcribe(client, token, content=b"x" * 11)

    assert response.status_code == 413
    assert response.json()["detail"][0]["type"] == "voice.audio_too_large"
    assert requests == []


async def test_transcribe_without_key_is_unavailable(
    client: AsyncClient, token: str, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr(llm_settings, "groq_api_key", None)
    requests = fake_groq(transcribed())

    response = await transcribe(client, token)

    assert response.status_code == 503
    assert response.json()["detail"][0]["type"] == "voice.transcription_unavailable"
    assert requests == []


async def test_transcribe_reports_unreadable_audio(client: AsyncClient, token: str):
    fake_groq(httpx2.Response(400, json={"error": {"message": "invalid media"}}))

    response = await transcribe(client, token)

    assert response.status_code == 422
    error = response.json()["detail"][0]
    assert error["type"] == "voice.invalid_audio"
    assert error["loc"] == ["body", "file"]


async def test_transcribe_reports_busy_with_retry_after(
    client: AsyncClient, token: str
):
    fake_groq(httpx2.Response(429, headers={"retry-after": "7"}))

    response = await transcribe(client, token)

    assert response.status_code == 503
    assert response.json()["detail"][0]["type"] == "voice.transcription_busy"
    assert response.headers["Retry-After"] == "7"


@pytest.mark.parametrize(
    "answer",
    [httpx2.Response(500), httpx2.ConnectError("Connection refused")],
    ids=["server-error", "unreachable"],
)
async def test_transcribe_reports_groq_failure(
    client: AsyncClient, token: str, answer: httpx2.Response | httpx2.HTTPError
):
    fake_groq(answer)

    response = await transcribe(client, token)

    assert response.status_code == 502
    assert response.json()["detail"][0]["type"] == "voice.transcription_failed"


async def test_transcribe_requires_sign_in(client: AsyncClient):
    requests = fake_groq(transcribed())

    response = await transcribe(client, None)

    assert response.status_code == 401
    assert response.json()["detail"][0]["type"] == "auth.not_authenticated"
    assert requests == []
