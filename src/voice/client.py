"""Transport for speech-to-text. Knows Groq, knows nothing about the routes using it."""

import httpx2

from src.voice.constants import GROQ_TRANSCRIPTION_URL, TRANSCRIPTION_MODEL


async def transcribe(
    http: httpx2.AsyncClient,
    *,
    api_key: str,
    audio: bytes,
    filename: str,
    media_type: str,
) -> str:
    """Return the speech in `audio` as text, raising httpx2.HTTPStatusError on a non-2xx response."""
    response = await http.post(
        GROQ_TRANSCRIPTION_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        data={"model": TRANSCRIPTION_MODEL, "response_format": "json"},
        files={"file": (filename, audio, media_type)},
        # Upload and decoding grow with the file; the client's default suits short calls.
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["text"].strip()
