from src.config import AppBaseSettings


class VoiceSettings(AppBaseSettings):
    transcription_max_bytes: int = 10_485_760  # 10 MiB


voice_settings = VoiceSettings()
