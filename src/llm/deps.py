from fastapi import Request, Depends
from typing import Annotated

from src.llm.registry import LLMRegistry

async def get_llm_registry(request: Request) -> LLMRegistry:
    return request.state.registry

LLMRegistryDep = Annotated[LLMRegistry, Depends(get_llm_registry)]