import httpx2
import logfire
from fastapi import UploadFile

from src.llm.config import llm_settings
from src.voice import client
from src.voice.config import voice_settings
from src.voice.constants import AUDIO_EXTENSIONS
from src.voice.exceptions import (
    AudioTooLarge,
    InvalidAudio,
    TranscriptionBusy,
    TranscriptionFailed,
    TranscriptionUnavailable,
    UnsupportedAudioType,
)
from src.voice.models import TranscriptionResponse


async def transcribe(
    http: httpx2.AsyncClient, *, file: UploadFile
) -> TranscriptionResponse:
    if llm_settings.groq_api_key is None:
        raise TranscriptionUnavailable()

    # Browsers add codec parameters, like "audio/webm;codecs=opus".
    media_type = (file.content_type or "").split(";")[0].strip().lower()
    extension = AUDIO_EXTENSIONS.get(media_type)
    if extension is None:
        raise UnsupportedAudioType(loc=["body", "file"])

    if file.size is not None and file.size > voice_settings.transcription_max_bytes:
        raise AudioTooLarge(loc=["body", "file"])

    try:
        text = await client.transcribe(
            http,
            api_key=llm_settings.groq_api_key.get_secret_value(),
            audio=await file.read(),
            # A recording arrives named "blob", and Groq goes by the extension.
            filename=f"audio.{extension}",
            media_type=media_type,
        )
    except httpx2.HTTPStatusError as exc:
        response = exc.response
        if response.status_code == 400:
            # Logged, since a request of ours that Groq rejects reads as bad audio too.
            logfire.warn("Transcription rejected", error=response.text)
            raise InvalidAudio(loc=["body", "file"]) from exc
        if response.status_code == 429:
            logfire.warn("Transcription rate limited")
            raise TranscriptionBusy(
                retry_after=response.headers.get("retry-after")
            ) from exc
        logfire.exception("Transcription failed", status=response.status_code)
        raise TranscriptionFailed() from exc
    except httpx2.HTTPError as exc:
        logfire.exception("Transcription failed")
        raise TranscriptionFailed() from exc

    return TranscriptionResponse(text=text)
