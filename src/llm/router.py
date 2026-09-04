from collections.abc import AsyncIterable

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent

from src.llm.agents import agent
from src.llm.deps import LLMRegistryDep, ModelDep
from src.llm.schemas import ModelPublic, SendMessageRequest

llm_router = APIRouter(prefix="/llm", tags=["LLM"])


@llm_router.get("/models", response_model=list[ModelPublic])
async def get_models_list(llm_registry: LLMRegistryDep):
    """List the models available to use."""
    return llm_registry.available()


# send_message api is just example of sending message to llms, later I will move this to /src/chat
@llm_router.post("/chat/{model_id}/message", response_class=EventSourceResponse)
async def send_message(
    request: SendMessageRequest, model: ModelDep, model_id: str
) -> AsyncIterable[ServerSentEvent]:
    """Stream the model's reply to the prompt as server-sent events."""
    async with agent.run_stream(model=model, user_prompt=request.prompt) as response:
        async for text in response.stream_text(delta=True):
            yield ServerSentEvent(raw_data=text)
