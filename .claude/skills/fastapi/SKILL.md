---
name: fastapi
description: FastAPI best practices and conventions. Use when working with FastAPI APIs, ORM (SQLAlchemy), Pydantic models, Dependencies, Streaming responses including Server-Sent Events (SSE), Websockets, API docs, Architecture (Project Structure), Authentication, Background tasks and Testing. Keeps FastAPI code clean and up to date with the latest features and patterns.
---

# FastAPI Best Practices & Development Guide

This guide provides the mandatory design principles, patterns, and conventions for developing FastAPI applications. For detailed code examples and deeper explanations, refer to the respective files in the `references/` directory.

---

## 1. Project Setup & Architecture
* **Version Pins**: Ensure compatibility with Python >= 3.11, FastAPI >= 0.115, Pydantic >= 2.7, pydantic-settings >= 2.4, SQLAlchemy >= 2.0 (async), Alembic >= 1.13, and PyJWT >= 2.9. Avoid unmaintained packages like `python-jose` or `async_asgi_testclient`.
* **Domain-Driven Directory Structure**: Organize by feature/domain packages (e.g., `src/auth/`, `src/posts/`) instead of technical layers.
* **Initialization**: Run server with `fastapi dev` / `fastapi run` and set up `uvloop` + `httptools` on non-Windows systems for high performance.
* **Explicit Imports**: Use explicit cross-domain imports (e.g., `from src.auth import service as auth_service`), avoiding wildcard imports.
* **Domain-Scoped Settings**: Subclass `BaseSettings` per domain instead of sharing a global one.
* **References**:
  * [Architecture & Project Structure](references/architecture_and_structure.md)
  * [Project Initialization Guide](references/initialize.md)
  * [Settings and Configuration](references/settings.md)

---

## 2. Routing & Path Operations
* **Router Parameters**: Define prefix, tags, and dependencies directly on the `APIRouter` instantiation (e.g., `router = APIRouter(prefix="/items")`) rather than when calling `include_router()`.
* **HTTP Operation Separation**: Use exactly one HTTP operation/verb per function. Never use `@app.api_route` to combine multiple methods in a single handler.
* **API Documentation**: Document all routes with explicit status codes, tags, summaries, descriptions, and error responses. Disable `/docs` and `/redoc` in production.
* **References**:
  * [Path Operations and Routing](references/path-operations.md)
  * [API Documentation](references/api_docs.md)

---

## 3. Dependency Injection
* **Use Annotated**: Always use `Annotated[T, Depends(func)]` instead of default-argument `Depends(...)` to avoid legacy pitfalls.
* **Validation & Security**: Validate inputs (e.g., check database existence, verify permissions) inside the dependency, raising exceptions early.
* **Dependency Scopes**: Use `yield` with the correct scope: `"request"` (default, cleans up after response) or `"function"` (cleans up before sending response).
* **Avoid Class Dependencies**: Prefer regular functions that construct and return class instances.
* **Event Loop Overhead**: Always use `async def` for dependencies unless they explicitly run blocking I/O (which Starlette handles via threadpools).
* **References**:
  * [Dependency Injection & Rules](references/dependencies.md)

---

## 4. Async & Event Loop Management
* **Route Declaration Decision**:
  * Use `async def` for non-blocking, `await`-able I/O.
  * Use `def` (sync) for blocking CPU/IO tasks (e.g. `time.sleep()`, sync DB clients) to run them in Starlette's threadpool.
  * Use `async def` + `run_in_threadpool(sync_func, ...)` to mix blocking calls inside async routes.
* **CPU-Bound Work**: Offload tasks taking >50ms to celery, arq, or RQ worker processes.
* **References**:
  * [Async Routes Decision Matrix](references/async_routes.md)

---

## 5. Database & Migrations
* **SQLAlchemy 2.0 Async**: Use `AsyncSession` and `async_sessionmaker`. Do not use `encode/databases`.
* **Database Naming Conventions**: Use singular `snake_case` tables, suffix `_at` for datetimes, and uniform foreign key naming. Apply a standard index/constraint naming convention.
* **SQL-First Performance**: Perform Joins, aggregations, and JSON formatting in PostgreSQL/SQL where possible. Only use Pydantic for validation and serialization, not transformation.
* **Static Migrations**: Write static, reversible Alembic migrations. Use `alembic init -t async migrations` and set the file template for descriptive filenames.
* **References**:
  * [Database Patterns](references/database.md)
  * [Migrations (Alembic)](references/migrations.md)

---

## 6. Pydantic & Response Handling
* **No Ellipsis or RootModel**: Do not use `...` or `RootModel` unless strictly necessary.
* **Clear Validation Constraints**: Never specify a constraint that contradicts the default (e.g., `Field(ge=18, default=None)` is invalid; use `int | None = Field(default=None, ge=18)` instead).
* **Modern Serialization**: Avoid deprecated `json_encoders`. Implement custom serializers using `@field_serializer` or `PlainSerializer`.
* **Filtering & Serialization**: Prefer annotating return types directly to validate and filter responses. Use `response_model` on the route decorator ONLY if the return type differs from the public schema (e.g., returning database ORM object or dict).
* **References**:
  * [Pydantic Validation & Serialization](references/pydantic.md)
  * [Response Types vs response_model](references/responses.md)

---

## 7. Authentication & Middleware
* **JWT Decode**: Always use `PyJWT` (`import jwt`) and catch `InvalidTokenError`. Do not use `python-jose`.
* **High-Performance Middleware**: Implement Pure ASGI middleware instead of inheriting from `BaseHTTPMiddleware` to avoid event-loop context-switching overhead.
* **Lifespan State**: Prefer managing startup/shutdown assets (e.g., clients, connections) via the async lifespan state dict rather than legacy `app.state`.
* **References**:
  * [Authentication (PyJWT)](references/authentication.md)
  * [Pure ASGI Middleware](references/middleware.md)
  * [Lifespan State Management](references/lifespan.md)

---

## 8. Background Work
* **Short & In-Process**: Use FastAPI's `BackgroundTasks` only for lightweight (<1s), non-critical tasks that can be safely lost if the worker restarts.
* **Heavy & Reliable**: Use Celery, Arq, or RQ for CPU-heavy tasks, scheduled cron jobs, retries, or rate-limiting.
* **References**:
  * [Background Work Decision Matrix](references/background_tasks.md)

---

## 9. Streaming & WebSockets
* **JSON Lines & Byte Streaming**: Stream data using `AsyncIterable` return type and `yield`. Avoid direct instantiation of `StreamingResponse` inside endpoints.
* **Server-Sent Events (SSE)**: Use `EventSourceResponse` with Pydantic serialization for plain objects, or yield `ServerSentEvent` instances for full control.
* **WebSockets**: Prefer `async for data in websocket.iter_text()` over `while True` to automatically handle `WebSocketDisconnect`.
* **References**:
  * [Streaming & SSE](references/streaming.md)
  * [WebSockets Patterns](references/websockets.md)

---

## 10. Testing & Debugging
* **Testing Client**: Use `httpx.AsyncClient` with `ASGITransport` for unit and integration testing.
* **Dependency Overrides**: Swap dependencies in tests using `app.dependency_overrides`. Clear it after execution.
* **Lifespan Testing**: Use `asgi-lifespan`'s `LifespanManager` to ensure startup/shutdown hooks execute during tests.
* **Test Markers**: Annotate async tests with `@pytest.mark.anyio` (restricting `anyio_backend` to `"asyncio"`).
* **Debugging Event Loop Blocks**: Run the application with `PYTHONASYNCIODEBUG=1` to print warnings for tasks blocking the event loop for >100ms.
* **References**:
  * [Testing with AsyncClient](references/testing.md)
  * [Debugging Loop Blocks](references/debugging.md)

---

## 11. Core Anti-Patterns Checklist
Before committing any FastAPI code, check for the following patterns:
* **No sync calls in async def**: Never use `time.sleep()`, `requests.get()`, `open()`, or sync database/ORM calls inside an `async def`.
* **No python-jose**: Replace `from jose import jwt` with `import jwt` (PyJWT).
* **No async_asgi_testclient**: Replace with `httpx.AsyncClient(transport=ASGITransport(app=app))`.
* **No legacy depends**: Replace `def route(x: T = Depends(...))` with `def route(x: Annotated[T, Depends(...)])`.
* **Check exception handling**: Avoid generic `except Exception` blocks around route bodies. Raise structured `HTTPException`s instead.
* **Double validation**: Avoid returning a Pydantic model while also setting `response_model` to that same model class.
* **References**:
  * [Full Anti-Patterns Guide](references/anti_patterns.md)