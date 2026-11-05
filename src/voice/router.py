from typing import Annotated

from fastapi import APIRouter, Depends, File, UploadFile

from src.auth.dependencies import get_current_user
from src.auth.exceptions import NotAuthenticated
from src.exceptions import error_responses
from src.http_client import HttpClientDep
from src.rate_limit import user_rate_limit
from src.voice import flows
from src.voice.config import voice_settings
from src.voice.exceptions import (
    AudioTooLarge,
    InvalidAudio,
    TranscriptionBusy,
    TranscriptionFailed,
    TranscriptionUnavailable,
    UnsupportedAudioType,
)
from src.voice.models import TranscriptionResponse

voice_router = APIRouter(prefix="/voice", tags=["Voice"])


@voice_router.post(
    path="/transcriptions",
    summary="Transcribe speech to text",
    description=(
        "Returns the speech in the language it was spoken in. Nothing is stored. "
        "WebM, Ogg, MP4, M4A, MP3, WAV or FLAC, up to "
        f"{voice_settings.transcription_max_bytes // 1_048_576} MiB."
    ),
    responses=error_responses(
        NotAuthenticated,
        UnsupportedAudioType,
        AudioTooLarge,
        InvalidAudio,
        TranscriptionFailed,
        TranscriptionUnavailable,
        TranscriptionBusy,
    ),
    # The user is never read, so sign-in is required here instead.
    dependencies=[
        Depends(get_current_user),
        Depends(user_rate_limit(times=10, seconds=60)),
    ],
)
async def transcribe(
    http: HttpClientDep, file: Annotated[UploadFile, File()]
) -> TranscriptionResponse:
    return await flows.transcribe(http, file=file)
