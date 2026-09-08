from fastapi import APIRouter

from src.llm.dependencies import LLMRegistryDep
from src.llm.models import ModelPublic

llm_router = APIRouter(prefix="/llms", tags=["LLM"])


@llm_router.get(
    path="/models", 
    response_model=list[ModelPublic],
    summary="List of available models"
)
async def get_models_list(llm_registry: LLMRegistryDep):
    return llm_registry.available()