# Lifespan

## Use Lifespan State instead of `app.state`

FastAPI supports the lifespan state, which defines a standard way to manage objects that need to be created at startup, and need to be used in the request-response cycle. The `app.state` is not recommended to be used anymore.

```py
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, TypedDict, cast

from fastapi import FastAPI, Request
from httpx import AsyncClient


class State(TypedDict):
    client: AsyncClient


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[State]:
    async with AsyncClient(app=app) as client:
        yield {"client": client}


app = FastAPI(lifespan=lifespan)


@app.get("/")
async def read_root(request: Request) -> dict[str, Any]:
    client = cast(AsyncClient, request.state.client)
    response = await client.get("/")
    return response.json()
```
