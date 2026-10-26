import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from functools import cached_property

import logfire
from pydantic_ai.exceptions import AgentRunError
from pydantic_ai.messages import ModelMessage
from pydantic_ai.ui.vercel_ai import VercelAIAdapter, VercelAIEventStream
from pydantic_ai.ui.vercel_ai.response_types import BaseChunk, ErrorChunk

from src.exceptions import AppError
from src.llm.exceptions import ModelError
from src.llm.models import AgentDeps


@dataclass(kw_only=True)
class ChatEventStream(VercelAIEventStream[AgentDeps, str]):
    """Vercel AI stream that logs a failed reply and sends the client only its error code."""

    model_id: str

    async def on_error(self, error: Exception) -> AsyncIterator[BaseChunk]:
        logfire.exception("Reply failed", _exc_info=error, model_id=self.model_id)
        app_error = ModelError() if isinstance(error, AgentRunError) else AppError()
        error_text = json.dumps({"detail": [app_error.serialize()]})
        # The base also closes the tool calls left open, so only its error is replaced.
        async for chunk in super().on_error(error):
            # The base sends str(error), which can carry provider internals.
            yield (
                ErrorChunk(error_text=error_text)
                if isinstance(chunk, ErrorChunk)
                else chunk
            )


@dataclass(kw_only=True)
class ChatAdapter(VercelAIAdapter[AgentDeps, str]):
    """Vercel AI adapter for chats whose history is read from the database, not the request."""

    model_id: str

    @cached_property
    def messages(self) -> list[ModelMessage]:
        # The prompt is stored before the run and comes back in message_history,
        # so the request's copy would reach the model twice.
        return []

    def build_event_stream(self) -> ChatEventStream:
        return ChatEventStream(
            self.run_input,
            accept=self.accept,
            sdk_version=self.sdk_version,
            server_message_id=self.server_message_id,
            model_id=self.model_id,
        )
