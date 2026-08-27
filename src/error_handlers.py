"""Exception handlers rendering every error as {"detail": [{msg, type, loc?}]}."""

from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.exceptions import AppError
from src.logging import get_logger

logger = get_logger(__name__)


async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"detail": [exc.serialize()]},
    )


async def handle_http_exception(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Covers the 404s and 405s Starlette raises for unmatched routes and methods."""
    item = {
        "msg": exc.detail,
        "type": HTTPStatus(exc.status_code).phrase.lower().replace(" ", "_"),
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": [item]},
        headers=exc.headers,
    )


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_error")
    return await handle_app_error(request, AppError())


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)
    app.add_exception_handler(Exception, handle_unexpected_error)
