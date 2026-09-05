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
    """Log an uncaught exception and hide it behind a generic 500."""
    logger.exception("unhandled_error")
    return await handle_app_error(request, AppError())


def register_error_handlers(app: FastAPI) -> None:
    """Attach every handler to the app."""
    app.add_exception_handler(AppError, handle_app_error)  # ty: ignore[invalid-argument-type]
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)  # ty: ignore[invalid-argument-type]
    app.add_exception_handler(Exception, handle_unexpected_error)
