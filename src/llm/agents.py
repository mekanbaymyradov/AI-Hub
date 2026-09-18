from pydantic_ai import Agent
from pydantic_ai.models.groq import GroqModelSettings

agent = Agent(instructions="You are helpful assistant. Be concise.")


title_agent = Agent(
    instructions=(
        "Write a title of at most six words for a chat that opens with the "
        "user's message. Use the message's language. Reply with the title "
        "only, without quotes or trailing punctuation. Do not answer the message."
    ),
    model_settings=GroqModelSettings(groq_reasoning_effort="low", timeout=5),
)
