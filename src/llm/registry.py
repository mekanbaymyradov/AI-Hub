from collections.abc import AsyncIterator, Iterable
from contextlib import AsyncExitStack, asynccontextmanager

from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.openai import OpenAIProvider

from src.llm.catalog import CATALOG, ModelSpec, ProviderId
from src.llm.config import LLMSettings
from src.logging import get_logger

logger = get_logger(__name__)


class LLMRegistry:
    """The models built for the configured providers, keyed by model id."""

    def __init__(self, models: dict[str, Model], specs: dict[str, ModelSpec]):
        self._models = models
        self._specs = specs

    def model(self, model_id: str) -> Model | None:
        """Return the model with this id, or None if it is unavailable."""
        return self._models.get(model_id)

    def available(self) -> list[ModelSpec]:
        """Return the spec of every available model."""
        return list(self._specs.values())

    def models(self) -> Iterable[Model]:
        """Return every available model."""
        return self._models.values()


def build_model(spec: ModelSpec, settings: LLMSettings) -> Model | None:
    """Build the model for this spec, or None if its provider has no API key."""
    match spec.provider:
        case ProviderId.ANTHROPIC if settings.anthropic_api_key:
            return AnthropicModel(
                spec.model_name,
                provider=AnthropicProvider(
                    api_key=settings.anthropic_api_key.get_secret_value()
                ),
            )
        case ProviderId.OPENAI if settings.openai_api_key:
            return OpenAIChatModel(
                spec.model_name,
                provider=OpenAIProvider(
                    api_key=settings.openai_api_key.get_secret_value()
                ),
            )
        case ProviderId.GOOGLE if settings.google_api_key:
            return GoogleModel(
                spec.model_name,
                provider=GoogleProvider(
                    api_key=settings.google_api_key.get_secret_value()
                ),
            )
        case _:
            logger.warning(
                "Skipping model, no API key configured", provider=spec.provider
            )
            return None


def build_registry(settings: LLMSettings) -> LLMRegistry:
    """Build a registry of every catalog model that could be built."""
    models: dict[str, Model] = {}
    specs: dict[str, ModelSpec] = {}
    for spec in CATALOG:
        model = build_model(spec, settings)
        if model is not None:
            models[spec.id] = model
            specs[spec.id] = spec
    return LLMRegistry(models, specs)


@asynccontextmanager
async def llm_lifespan(settings: LLMSettings) -> AsyncIterator[LLMRegistry]:
    """Build the registry and keep each model's HTTP client open for the app's lifetime.

    Without this, the model an agent run is handed is exited when that run ends, which
    closes the provider's connection pool and forces a handshake on every request.
    """
    registry = build_registry(settings)
    async with AsyncExitStack() as stack:
        for model in registry.models():
            await stack.enter_async_context(model)
        yield registry
