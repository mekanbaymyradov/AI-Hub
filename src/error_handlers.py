from http import HTTPStatus

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.exceptions import AppError


async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status,
        content={"detail": [exc.serialize()]},
        headers=exc.headers,
    )


async def handle_http_exception(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    detail = {
        "msg": exc.detail,
        "type": HTTPStatus(exc.status_code).phrase.lower().replace(" ", "_"),
    }
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": [detail]},
        headers=exc.headers,
    )


async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    """Hide an uncaught exception behind a generic 500.

    Starlette re-raises the exception after this runs, so the request span records it.
    """
    return await handle_app_error(request, AppError())


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)  # ty: ignore[invalid-argument-type]
    app.add_exception_handler(StarletteHTTPException, handle_http_exception)  # ty: ignore[invalid-argument-type]
    app.add_exception_handler(Exception, handle_unexpected_error)
