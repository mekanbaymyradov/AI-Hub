import logging
import os
from typing import Any

import logfire
from fastapi import Request, WebSocket
from logfire.integrations.httpx import RequestInfo
from opentelemetry.instrumentation.botocore import BotocoreInstrumentor
from opentelemetry.trace import Span

from src.config import settings
from src.database import engine


def setup_observability() -> None:
    logfire.configure(
        service_name=settings.project_title, environment=settings.environment
    )

    # A missing token only turns sending off (see pyproject.toml).
    if settings.environment == "production" and not os.environ.get("LOGFIRE_TOKEN"):
        logfire.warn("Logfire token missing, telemetry stays on the console")

    # Library warnings and errors, like asyncio's "Task exception was never
    # retrieved", reach Logfire too.
    logging.basicConfig(handlers=[logfire.LogfireLoggingHandler()])

    logfire.instrument_sqlalchemy(engine=engine)
    # Every outgoing client here is async (the shared httpx2 client and the LLM
    # SDKs'), and request_hook would only cover sync ones.
    logfire.instrument_httpx(async_request_hook=drop_url_query)
    # boto3 (R2) sends over urllib3, which instrument_httpx doesn't see, and
    # Logfire has no botocore helper.
    BotocoreInstrumentor().instrument()
    logfire.instrument_redis()
    # Users' chat text stays out of production traces.
    logfire.instrument_pydantic_ai(include_content=settings.environment == "local")


async def drop_url_query(span: Span, request: RequestInfo) -> None:
    """Remove the query string from an outgoing request's span URL, in production."""
    if settings.environment == "production":
        # Tools put user input in query strings, like a city name, and Logfire
        # never scrubs URLs.
        span.set_attribute("http.url", str(request.url.copy_with(query=None)))


def request_attributes_mapper(
    request: Request | WebSocket, attributes: dict[str, Any]
) -> dict[str, Any]:
    """Choose what a request span records about the endpoint's arguments.

    Production keeps only validation errors, without the rejected input.
    """
    if settings.environment == "production":
        # Inputs carry sign-in codes, emails and chat text, and so does each
        # error's "input".
        errors = [
            {k: v for k, v in error.items() if k != "input"}
            for error in attributes["errors"]
        ]
        return {"errors": errors}

    # What the client sent; dependency results (DB session, clients, ORM rows)
    # only add noise.
    dependant = request.scope["route"].dependant
    params = dependant.path_params + dependant.query_params + dependant.body_params
    names = {param.name for param in params}
    values = {k: v for k, v in attributes["values"].items() if k in names}
    return {"values": values, "errors": attributes["errors"]}
