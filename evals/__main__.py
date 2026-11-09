import argparse
import asyncio
from pathlib import Path

import httpx2
import logfire
from pydantic import SecretStr
from pydantic_ai.direct import model_request
from pydantic_ai.exceptions import ModelAPIError, ModelHTTPError
from pydantic_ai.messages import ModelRequest
from pydantic_ai.models import Model
from pydantic_ai.retries import RetryConfig
from pydantic_ai.settings import ModelSettings
from pydantic_evals import Dataset
from pydantic_evals.reporting import EvaluationReport
from tenacity import (
    AsyncRetrying,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from evals.evaluators import (
    CaseMetadata,
    CodeFencesTagged,
    Grader,
    NoFillerOpener,
    WithinWordLimit,
)
from src.config import AppBaseSettings
from src.llm.agents import agent
from src.llm.config import llm_settings
from src.llm.models import CATALOG, AgentDeps, ModelSpec
from src.llm.registry import llm_lifespan

GRADER_MODEL = "groq:openai/gpt-oss-120b"


class EvalSettings(AppBaseSettings):
    # Evals run on the host, where .env isn't loaded into the environment.
    logfire_token: SecretStr


# Groq wraps a network failure in a bare ModelAPIError; Mistral's arrives as is.
UNAVAILABLE = (ModelAPIError, httpx2.TransportError)


def is_transient(exc: BaseException) -> bool:
    """Return whether a retry could succeed: rate limits, server errors and network failures."""
    if isinstance(exc, ModelHTTPError):
        return exc.status_code == 429 or exc.status_code >= 500
    return isinstance(exc, UNAVAILABLE)


# Provider SDKs already retry a couple of times; these waits outlast Groq's
# one-minute token window and short network outages.
RETRY = RetryConfig(
    retry=retry_if_exception(is_transient),
    wait=wait_exponential(multiplier=5, max=60),
    stop=stop_after_attempt(5),
    reraise=True,
)


async def ping(model: Model) -> None:
    """Send a tiny request, raising an UNAVAILABLE error when the model can't answer."""
    async for attempt in AsyncRetrying(**RETRY):
        with attempt:
            await model_request(
                model,
                [ModelRequest.user_text_prompt("Reply with OK.")],
                model_settings=ModelSettings(max_tokens=16),
            )


async def run(
    dataset: Dataset[str, str, CaseMetadata], name: str, model_ids: list[str]
) -> None:
    async with (
        llm_lifespan(llm_settings) as registry,
        httpx2.AsyncClient(timeout=10) as http,
    ):
        grader_spec = registry.spec(GRADER_MODEL)
        if grader_spec is None:
            raise SystemExit(f"The grader, {GRADER_MODEL}, has no API key in .env.")
        grader_model = registry.model(grader_spec)
        try:
            await ping(grader_model)
        except UNAVAILABLE as exc:
            raise SystemExit(f"The grader is unavailable: {exc!r}") from None

        for evaluator in (
            NoFillerOpener(),
            CodeFencesTagged(),
            WithinWordLimit(),
            Grader(grader_model),
        ):
            dataset.add_evaluator(evaluator)

        for model_id in model_ids:
            spec = registry.spec(model_id)
            if spec is None:
                print(f"Skipping {model_id}: no API key in .env.")
                continue
            model = registry.model(spec)
            try:
                await ping(model)
            except UNAVAILABLE as exc:
                print(f"Skipping {spec.display_name}: {exc!r}")
                continue
            report = await evaluate_model(dataset, name, spec, model, http)
            report.print()


async def evaluate_model(
    dataset: Dataset[str, str, CaseMetadata],
    name: str,
    spec: ModelSpec,
    model: Model,
    http: httpx2.AsyncClient,
) -> EvaluationReport[str, str, CaseMetadata]:
    async def answer(message: str) -> str:
        deps = AgentDeps(name=None, instructions=None, http=http)
        result = await agent.run(message, model=model, deps=deps)
        return result.output

    return await dataset.evaluate(
        answer,
        name=f"{name} · {spec.display_name}",
        # One case at a time stays near Groq's free 8K tokens per minute.
        max_concurrency=1,
        retry_task=RETRY,
        retry_evaluators=RETRY,
        metadata={"prompt_version": name, "model": spec.id, "grader": GRADER_MODEL},
    )


def main() -> None:
    dataset = Dataset[str, str, CaseMetadata].from_file(
        Path(__file__).with_name("cases.yaml")
    )
    catalog_ids = [spec.id for spec in CATALOG]

    parser = argparse.ArgumentParser(
        prog="python -m evals",
        description=(
            "Answer the cases with each model, grade them, and send the results "
            "to Logfire. Models without an API key, or that fail a test request, "
            "are skipped."
        ),
    )
    parser.add_argument(
        "--name",
        required=True,
        help="Prompt version these runs measure, like 'baseline'.",
    )
    parser.add_argument(
        "--model",
        action="append",
        choices=catalog_ids,
        help="Model to answer with; repeat for several. Defaults to every model.",
    )
    parser.add_argument(
        "--exclude",
        action="append",
        default=[],
        choices=catalog_ids,
        help="Model to leave out; repeat for several.",
    )
    parser.add_argument(
        "--case",
        action="append",
        choices=[case.name for case in dataset.cases],
        help="Run only this case; repeat for several. Defaults to all.",
    )
    args = parser.parse_args()

    if args.case:
        dataset.cases = [case for case in dataset.cases if case.name in args.case]
    model_ids = [m for m in args.model or catalog_ids if m not in args.exclude]

    logfire.configure(
        service_name="evals",
        token=EvalSettings().logfire_token.get_secret_value(),
        # The printed report is the console output; spans go to Logfire only.
        console=False,
        # The data is our own test questions, and scrubbing hid every answer
        # that mentions words like "password" or "auth" from review.
        scrubbing=False,
    )
    logfire.instrument_pydantic_ai()

    asyncio.run(run(dataset, args.name, model_ids))


if __name__ == "__main__":
    main()
