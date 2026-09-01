from typing import Annotated

from fastapi import Depends, Request
from pydantic_ai.models import Model

from src.llm.exceptions import ModelNotFound
from src.llm.registry import LLMRegistry


async def get_llm_registry(request: Request) -> LLMRegistry:
    """Return the registry built during the app's lifespan."""
    return request.state.registry


LLMRegistryDep = Annotated[LLMRegistry, Depends(get_llm_registry)]


async def get_model(model_id: str, llm_registry: LLMRegistryDep) -> Model:
    """Resolve a model id to a model, or raise ModelNotFound."""
    model = llm_registry.model(model_id)
    if model is None:
        raise ModelNotFound(loc=["model_id"])
    return model


ModelDep = Annotated[Model, Depends(get_model)]
