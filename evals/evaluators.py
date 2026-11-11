import re
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.models import Model
from pydantic_ai.models.groq import GroqModelSettings
from pydantic_evals.evaluators import (
    EvaluationReason,
    Evaluator,
    EvaluatorContext,
    EvaluatorOutput,
)


class CaseMetadata(BaseModel):
    category: str
    max_words: int | None = None


Context = EvaluatorContext[str, str, CaseMetadata]

FILLER_OPENER = re.compile(
    r"^\W*(?:(?:great|good|excellent) question|sure\b|certainly\b|of course\b"
    r"|absolutely\b|i['’]?d be (?:happy|glad)|happy to help)",
    re.IGNORECASE,
)
CODE_FENCE = re.compile(r"^\s*```(.*)$", re.MULTILINE)


@dataclass
class NoFillerOpener(Evaluator[str, str, CaseMetadata]):
    """Match English phrases only; the grader's answers_first covers every language."""

    def evaluate(self, ctx: Context) -> bool:
        return not FILLER_OPENER.match(ctx.output)


@dataclass
class CodeFencesTagged(Evaluator[str, str, CaseMetadata]):
    def evaluate(self, ctx: Context) -> EvaluatorOutput:
        # Fences alternate opening and closing, and only an opening one has a language.
        openings = CODE_FENCE.findall(ctx.output)[::2]
        if not openings:
            return {}  # No code, so the check doesn't apply.
        return all(info.strip() for info in openings)


@dataclass
class WithinWordLimit(Evaluator[str, str, CaseMetadata]):
    def evaluate(self, ctx: Context) -> EvaluatorOutput:
        limit = ctx.metadata.max_words if ctx.metadata else None
        if limit is None:
            return {}
        words = len(ctx.output.split())
        return EvaluationReason(words <= limit, reason=f"{words} words, limit {limit}")


class Verdict(BaseModel):
    reason: str = Field(
        description="One or two sentences on why the rule passes or fails."
    )
    passed: bool


# Field descriptions are the rubric: the grader reads them in its output schema.
class Grades(BaseModel):
    answers_first: Verdict = Field(
        description=(
            "Opens with the substance. When the user asked for something to be "
            "produced, such as code or an email, starting with it passes, "
            "including its natural first part like a code block or an email's "
            "subject line. Otherwise the opening sentence answers the message. "
            "Fails on a title or heading, a restatement of the topic, praise for "
            "the question, a hedge such as 'Both are great choices' or 'It "
            "depends' where the recommendation or key difference should be, or "
            "a lead-in such as 'Here's a…', 'Here is…', "
            "'Below is…' or 'Let's break it down', even when the content "
            "follows. A direct, natural reply to small talk passes."
        )
    )
    format_fits: Verdict = Field(
        description=(
            "Formatting suits the content: numbered lists for sequential steps, "
            "a table or parallel structure for comparing several attributes, "
            "code blocks for code, and plain prose for explanations, advice, "
            "short answers and conversation. Fails on headers, bullets or heavy "
            "bold in a short or conversational answer, and on a wall of text "
            "where structure was needed."
        )
    )
    same_language: Verdict = Field(
        description=(
            "Written in the language of the user's message. Code, commands and "
            "technical terms may stay in English."
        )
    )
    no_closing_filler: Verdict = Field(
        description=(
            "Ends when the content ends. Fails on a closing recap of points "
            "already made, or a generic offer of more help such as 'Let me know "
            "if…', 'Want me to…?' or 'Hope this helps!'."
        )
    )
    correct_and_complete: Verdict = Field(
        description=(
            "Factually correct, and covers what the user needs to act on it. "
            "When a reference answer is given, agrees with it. Brevity alone is "
            "not a failure if nothing important is missing."
        )
    )


grader_agent = Agent(
    output_type=Grades,
    instructions=(
        "You grade a chat assistant's answer to a user's message against "
        "several rules. Judge each rule on its own, so a failure on one never "
        "affects another. Pass a rule only when the answer clearly meets it."
    ),
    # Low effort keeps each grade cheap under Groq's free-tier token limits.
    model_settings=GroqModelSettings(groq_reasoning_effort="low", temperature=0),
)


@dataclass
class Grader(Evaluator[str, str, CaseMetadata]):
    """Grade every rule in Grades with one model request.

    One request per answer instead of one per rule keeps a full run within
    Groq's free daily token cap.
    """

    model: Model

    async def evaluate(self, ctx: Context) -> EvaluatorOutput:
        reference = (
            f"<reference_answer>\n{ctx.expected_output}\n</reference_answer>\n"
            if ctx.expected_output
            else ""
        )
        prompt = (
            f"<message>\n{ctx.inputs}\n</message>\n"
            f"{reference}"
            f"<answer>\n{ctx.output}\n</answer>"
        )
        result = await grader_agent.run(prompt, model=self.model)
        return {
            rule: EvaluationReason(verdict.passed, reason=verdict.reason)
            for rule, verdict in dict(result.output).items()
        }

    def build_serialization_arguments(self) -> dict[str, Any]:
        # Results record their evaluator's arguments, and a Model object isn't
        # serializable; its id is all a reader needs.
        return {"model": f"{self.model.system}:{self.model.model_name}"}
