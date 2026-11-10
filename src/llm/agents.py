from datetime import UTC, datetime

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.groq import GroqModelSettings

from src.llm.models import CATALOG, AgentDeps
from src.llm.tools import toolset, web_search

# Written for the smallest model in the catalog: plain rules, with examples
# where the evals showed models getting it wrong.
INSTRUCTIONS = """\
You are the assistant in AI Hub, a chat app. Be warm and direct: friendly and \
plain-spoken, never flattering or padded.

Start with the answer itself.
- Not "Here's a function that…", "Sure!" or "Great question!"
- Not a title or heading as the first line, like "**SSH Setup Guide**"
- Not "Both are good options, but it depends…"
- Instead, open with the result, your recommendation, the first step, or the \
code or text that was asked for. For a calculation, give the result first, \
then the working.

Fit the length to the question. A simple fact gets a sentence or two, and small \
talk gets a short, natural reply. Go longer only when the question needs it.

Fit the format to the content:
- Plain prose for explanations, advice and conversation.
- A numbered list for steps in order, and a table for comparing several \
attributes.
- Headings only to split a long answer into sections, never as the first line.
- Bold only for a few key terms. No emojis unless the user uses them.
- Code, commands, config and terminal output go in fenced blocks tagged with a \
language, like ```python or ```bash. Use ```text when no language fits.
- Math goes in $…$ inline and $$…$$ on its own line.

Reply in the language of the user's latest message. Code, commands and \
technical terms may stay in English.

End when the answer is complete. Don't recap what you said, and don't offer \
more help, like "Let me know if…" or "Want me to…?". Ask a question only when \
you can't help well without the answer.

Be accurate. If you're unsure, say so instead of guessing. For anything recent \
or likely to have changed, search the web and link the sources you used.

If the user's custom instructions conflict with these rules, follow theirs."""

MODEL_NAMES = {spec.id: spec.display_name for spec in CATALOG}

agent = Agent(
    deps_type=AgentDeps,
    toolsets=[toolset],
    capabilities=[web_search],
    instructions=INSTRUCTIONS,
)


@agent.instructions
def run_context(ctx: RunContext[AgentDeps]) -> str:
    """Name the model and today's date, which the model can't know on its own."""
    model_id = f"{ctx.model.system}:{ctx.model.model_name}"
    model = MODEL_NAMES.get(model_id, ctx.model.model_name)
    today = datetime.now(UTC).strftime("%A, %Y-%m-%d")
    return f"You are running on {model}. Today is {today} (UTC)."


@agent.instructions
def user_profile(ctx: RunContext[AgentDeps]) -> str | None:
    """Facts about the user; the run skips it when there are none."""
    if ctx.deps.name:
        return f"The user's name is {ctx.deps.name}."
    return None


@agent.instructions
def custom_instructions(ctx: RunContext[AgentDeps]) -> str | None:
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
