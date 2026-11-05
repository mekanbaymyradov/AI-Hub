from src.exceptions import AppError, ContentTooLargeError, UnsupportedMediaTypeError


class UnsupportedAudioType(UnsupportedMediaTypeError):
    type = "voice.unsupported_audio_type"
    msg = "Audio must be WebM, Ogg, MP4, M4A, MP3, WAV or FLAC."


class AudioTooLarge(ContentTooLargeError):
    type = "voice.audio_too_large"
    msg = "Audio is too large."


class InvalidAudio(AppError):
    """The provider could not read the audio, so the user should record again."""

    status = 422
    type = "voice.invalid_audio"
    msg = "Couldn't read the audio."


class TranscriptionFailed(AppError):
    status = 502
    type = "voice.transcription_failed"
    msg = "Transcription failed."


class TranscriptionUnavailable(AppError):
    """No provider key is configured."""

    status = 503
    type = "voice.transcription_unavailable"
    msg = "Voice input is not available."


class TranscriptionBusy(AppError):
    """The provider's quota, shared by every user of the app, is used up for now."""

    status = 503
    type = "voice.transcription_busy"
    msg = "Voice input is busy. Try again shortly."

    def __init__(self, retry_after: str | None):
        super().__init__()
        if retry_after is not None:
            self.headers = {"Retry-After": retry_after}
