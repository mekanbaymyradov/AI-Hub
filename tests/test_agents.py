import pytest
from pydantic_ai.messages import ModelMessage, ModelResponse, TextPart
from pydantic_ai.models.function import AgentInfo, FunctionModel

from src.llm.agents import agent
from src.llm.models import UserContext

pytestmark = pytest.mark.anyio

BASE_INSTRUCTIONS = "You are helpful assistant. Be concise."


def echo_instructions(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    """Reply with the instructions the model was sent."""
    return ModelResponse(parts=[TextPart(info.instructions or "")])


async def sent_instructions(deps: UserContext) -> str:
    result = await agent.run("hi", model=FunctionModel(echo_instructions), deps=deps)
    return result.output


async def test_name_and_instructions_follow_base_instructions():
    sent = await sent_instructions(
        UserContext(name="Alice", instructions="Answer in Turkmen.")
    )

    assert sent == (
        f"{BASE_INSTRUCTIONS}\n\n"
        "The user's name is Alice.\n\n"
        "The user has set these custom instructions for how you respond:\n"
        "Answer in Turkmen."
    )


async def test_only_set_fields_are_sent():
    sent = await sent_instructions(UserContext(name=None, instructions="Be brief."))

    assert "The user's name" not in sent
    assert sent.endswith("Be brief.")


async def test_empty_context_sends_base_instructions_only():
    sent = await sent_instructions(UserContext(name=None, instructions=None))

    assert sent == BASE_INSTRUCTIONS
