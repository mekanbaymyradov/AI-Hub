from pydantic_ai import Agent, RunContext
from pydantic_ai.models.groq import GroqModelSettings

from src.llm.models import UserContext

agent = Agent(
    deps_type=UserContext, instructions="You are helpful assistant. Be concise."
)


@agent.instructions
def user_profile(ctx: RunContext[UserContext]) -> str | None:
    """Facts about the user; the run skips it when there are none."""
    if ctx.deps.name:
        return f"The user's name is {ctx.deps.name}."
    return None


@agent.instructions
def custom_instructions(ctx: RunContext[UserContext]) -> str | None:
    """How the user asked to be answered, from their profile settings."""
    if ctx.deps.instructions:
        return (
            "The user has set these custom instructions for how you respond:\n"
            f"{ctx.deps.instructions}"
        )
    return None


title_agent = Agent(
    instructions=(
        "Write a title of at most six words for a chat that opens with the "
        "user's message. Use the message's language. Reply with the title "
        "only, without quotes or trailing punctuation. Do not answer the message."
    ),
    model_settings=GroqModelSettings(groq_reasoning_effort="low", timeout=5),
)
