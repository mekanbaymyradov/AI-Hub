from pydantic_ai.models import Model
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.providers.google import GoogleProvider

from src.llm.catalog import CATALOG, ModelSpec, ProviderId
from src.llm.config import LLMSettings
from src.logging import get_logger


logger = get_logger(__name__)

class LLMRegistry:
    def __init__(self, models: dict[str, Model], specs: dict[str, ModelSpec]):
        self._models = models
        self._specs = specs

    def model(self, model_id: str) -> Model:
        try:
            return self._models[model_id]
        except KeyError:
            raise ValueError(f"Provider not available for model '{model_id}'") from None

    def available(self) -> list[ModelSpec]:
        return list(self._specs.values())

def build_model(spec: ModelSpec, settings: LLMSettings) -> Model | None:
    match spec.provider:
        case ProviderId.ANTHROPIC if settings.anthropic_api_key:
            return AnthropicModel(
                spec.model_name,
                provider=AnthropicProvider(api_key=settings.anthropic_api_key.get_secret_value())
            )
        case ProviderId.OPENAI if settings.openai_api_key:
            return OpenAIChatModel(
                spec.model_name,
                provider=OpenAIProvider(api_key=settings.openai_api_key.get_secret_value())
            )
        case ProviderId.GOOGLE if settings.google_api_key:
            return GoogleModel(
                spec.model_name,
                provider=GoogleProvider(api_key=settings.google_api_key.get_secret_value())
            )
        case _:
            logger.warning(
                "Skipping model '%s': no API key configured for provider '%s'",
                spec.id, spec.provider
            )
            return None

def build_registry(settings: LLMSettings) -> LLMRegistry:
    models: dict[str, Model] = {}
    specs: dict[str, ModelSpec] = {}
    for spec in CATALOG:
        model = build_model(spec, settings)
        if model is not None:
            models[spec.id] = model
            specs[spec.id] = spec
    return LLMRegistry(models, specs)