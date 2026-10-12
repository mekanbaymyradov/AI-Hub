from datetime import datetime
from zoneinfo import ZoneInfo

import httpx2
import pytest
from httpx2 import AsyncClient
from pydantic_ai import RunContext, RunUsage
from pydantic_ai.messages import (
    ModelMessage,
    ModelResponse,
    RetryPromptPart,
    TextPart,
    ToolCallPart,
    ToolReturnPart,
)
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.models.groq import GroqModel
from pydantic_ai.native_tools import WebSearchTool
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.groq import GroqProvider

from src.llm.agents import agent
from src.llm.models import AgentDeps
from src.llm.tools import Weather, _native_web_search

pytestmark = pytest.mark.anyio


async def test_models_returns_available_models(client: AsyncClient):
    response = await client.get("/llms/models")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": "groq:test-model",
            "provider": "groq",
            "display_name": "Test Model",
            "supports_files": True,
        },
        {
            "id": "groq:text-only-model",
            "provider": "groq",
            "display_name": "Text Only Model",
            "supports_files": False,
        },
    ]


# Tools


def fake_http(responses: dict[str, httpx2.Response]) -> httpx2.AsyncClient:
    """A client that answers each request by its URL's host, never over the network."""
    return httpx2.AsyncClient(
        transport=httpx2.MockTransport(lambda request: responses[request.url.host])
    )


async def call_tool(
    name: str, args: dict, http: httpx2.AsyncClient | None = None
) -> ToolReturnPart | RetryPromptPart:
    """Run the agent with a model that calls one tool, and return what the tool sent back."""

    def reply(messages: list[ModelMessage], _info: AgentInfo) -> ModelResponse:
        if len(messages) == 1:
            return ModelResponse(parts=[ToolCallPart(name, args)])
        return ModelResponse(parts=[TextPart("Done.")])

    deps = AgentDeps(name=None, instructions=None, http=http or fake_http({}))
    with agent.override(model=FunctionModel(reply)):
        result = await agent.run("Go", deps=deps)

    [part] = [
        part
        for message in result.all_messages()
        for part in message.parts
        if isinstance(part, ToolReturnPart | RetryPromptPart)
    ]
    return part


async def test_get_current_time_uses_timezone():
    part = await call_tool("get_current_time", {"timezone": "Asia/Ashgabat"})

    assert isinstance(part, ToolReturnPart)
    today = datetime.now(ZoneInfo("Asia/Ashgabat")).strftime("%A, %Y-%m-%d")
    assert str(part.content).startswith(today)


async def test_get_current_time_retries_unknown_timezone():
    part = await call_tool("get_current_time", {"timezone": "Mars/Olympus"})

    assert isinstance(part, RetryPromptPart)
    assert "Unknown timezone 'Mars/Olympus'" in str(part.content)


async def test_get_weather_returns_current_conditions():
    http = fake_http(
        {
            "geocoding-api.open-meteo.com": httpx2.Response(
                200,
                json={
                    "results": [
                        {
                            "name": "Paris",
                            "country": "France",
                            "latitude": 48.85,
                            "longitude": 2.35,
                        }
                    ]
                },
            ),
            "api.open-meteo.com": httpx2.Response(
                200,
                json={
                    "current": {
                        "temperature_2m": 18.5,
                        "apparent_temperature": 17.0,
                        "weather_code": 2,
                        "wind_speed_10m": 12.3,
                    }
                },
            ),
        }
    )

    part = await call_tool("get_weather", {"city": "Paris"}, http)

    assert isinstance(part, ToolReturnPart)
    assert part.content == Weather(
        place="Paris, France",
        temperature_c=18.5,
        feels_like_c=17.0,
        wind_kmh=12.3,
        conditions="partly cloudy",
    )


async def test_get_weather_retries_unknown_city():
    http = fake_http({"geocoding-api.open-meteo.com": httpx2.Response(200, json={})})

    part = await call_tool("get_weather", {"city": "Atlantis"}, http)

    assert isinstance(part, RetryPromptPart)
    assert "No place named 'Atlantis'" in str(part.content)


async def test_get_weather_fails_when_service_is_down():
    http = fake_http({"geocoding-api.open-meteo.com": httpx2.Response(503)})

    part = await call_tool("get_weather", {"city": "Paris"}, http)

    # Reported to the model, which can tell the user, instead of failing the reply.
    assert isinstance(part, ToolReturnPart)
    assert part.outcome == "failed"


async def test_native_web_search_only_where_verified():
    deps = AgentDeps(name=None, instructions=None, http=fake_http({}))
    # Built with dummy keys; nothing is sent.
    groq = GroqModel("openai/gpt-oss-20b", provider=GroqProvider(api_key="test"))
    claude = AnthropicModel(
        "claude-sonnet-5", provider=AnthropicProvider(api_key="test")
    )

    # pydantic-ai would send Groq a built-in search it rejects, so Groq searches locally.
    groq_ctx = RunContext(deps=deps, model=groq, usage=RunUsage())
    assert _native_web_search(groq_ctx) is None
    claude_ctx = RunContext(deps=deps, model=claude, usage=RunUsage())
    assert isinstance(_native_web_search(claude_ctx), WebSearchTool)
