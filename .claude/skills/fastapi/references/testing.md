# Testing

## Async client from day one
```python
import pytest
from httpx import AsyncClient, ASGITransport

from src.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_create_post(client: AsyncClient):
    resp = await client.post("/posts", json={"title": "hi"})
    assert resp.status_code == 201
```

> **Don't** use `async_asgi_testclient` — it's unmaintained. The example above (httpx +
> `ASGITransport`) is the supported path.

## Override dependencies in tests
Don't monkeypatch internals. Use FastAPI's built-in `dependency_overrides`.

```python
from src.auth.dependencies import parse_jwt_data
from src.main import app


def fake_user():
    return {"user_id": "00000000-0000-0000-0000-000000000001"}


@pytest.fixture(autouse=True)
def _override_auth():
    app.dependency_overrides[parse_jwt_data] = fake_user
    yield
    app.dependency_overrides.clear()
```

## Testing Lifespan Events
If you are using lifespan events (`on_startup`, `on_shutdown` or the `lifespan` parameter), you can use the `asgi-lifespan` package to run those events during testing.

```py
import pytest
from asgi_lifespan import LifespanManager
from httpx import AsyncClient, ASGITransport
from src.main import app


@pytest.fixture
async def client_with_lifespan():
    async with LifespanManager(app) as manager:
        transport = ASGITransport(app=manager.app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
```

## Use `pytest.mark.anyio` instead of `pytest.mark.asyncio`

You already have `anyio` installed, since it's a dependency of Starlette. Which means, you can use `pytest.mark.anyio` instead of `pytest.mark.asyncio`.

```py
import pytest


@pytest.mark.anyio
async def test_async_function(): ...
```

By default, `anyio` runs every test that has the marker twice, once with `trio` and another time with `asyncio`. You probably want to restrict that by using either one or the other, in case you are testing an application, and not a package:

```py
import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"  # or "trio"
```
