from fastapi import Request, Depends
from typing import Annotated

from pydantic_ai.models import Model

from src.llm.exceptions import ModelNotFound
from src.llm.registry import LLMRegistry

async def get_llm_registry(request: Request) -> LLMRegistry:
    return request.state.registry

LLMRegistryDep = Annotated[LLMRegistry, Depends(get_llm_registry)]


async def get_model(model_id: str, llm_registry: LLMRegistryDep) -> Model:
    model = llm_registry.model(model_id)
    if model is None:
        raise ModelNotFound(loc=["model_id"])
    return model

ModelDep = Annotated[Model, Depends(get_model)]
