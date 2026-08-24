from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent
from collections.abc import AsyncIterable

from src.llm.schemas import ModelPublic, SendMessageRequest, SendMessageResponse
from src.llm.deps import LLMRegistryDep
from src.llm.agent import agent

llm_router = APIRouter(prefix="/llm", tags=["LLM"])

@llm_router.get("/models", response_model=list[ModelPublic])
async def get_models_list(llm_registry: LLMRegistryDep):
    return llm_registry.available()


@llm_router.post("/chat/message", response_class=EventSourceResponse) 
async def send_message(
    request: SendMessageRequest,
    llm_registry: LLMRegistryDep,

) -> AsyncIterable[ServerSentEvent]:
    model = llm_registry.model(request.model_id)

    async with agent.run_stream(model=model, user_prompt=request.prompt) as response:
        async for text in response.stream_text(delta=True):
            yield ServerSentEvent(raw_data=text)
