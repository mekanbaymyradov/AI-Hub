# Async Routes

## Decision rule

| Route does this                        | Use         |
|----------------------------------------|-------------|
| `await`-able non-blocking I/O          | `async def` |
| Blocking I/O (no async client exists)  | `def` (sync, runs in threadpool) |
| Mix of both                            | `async def` + `run_in_threadpool` for the blocking part |
| CPU-bound work (>50 ms compute)        | Offload to a worker process (Celery / RQ / Arq) |

## Do / Don't

```python
# DON'T — blocking call inside async route freezes the entire event loop
@router.get("/bad")
async def bad():
    time.sleep(10)  # blocks every request on this worker
    return {"ok": True}


# DO — sync route lets FastAPI run it in a threadpool
@router.get("/sync-ok")
def sync_ok():
    time.sleep(10)  # blocks one threadpool worker, not the loop
    return {"ok": True}


# DO — async route with awaitable sleep
@router.get("/async-ok")
async def async_ok():
    await asyncio.sleep(10)  # yields control, loop keeps serving requests
    return {"ok": True}


# DO — async route that has to call a sync library
from fastapi.concurrency import run_in_threadpool


@router.get("/wrap")
async def wrap():
    result = await run_in_threadpool(legacy_sync_client.fetch, "id")
    return result
```

## Threadpool caveats
- Default Starlette threadpool size is 40. Saturating it slows every sync route. If you use all of them, your application will be blocked.
- Threads cost more than coroutines. Don't use sync routes "just because."
- Be careful with non-async functions: There's a performance penalty when you use non-async functions in FastAPI because FastAPI will call `run_in_threadpool`, which will run the function using a thread pool.

To change the number of threads available:

```py
import anyio
from contextlib import asynccontextmanager
from typing import Iterator

from fastapi import FastAPI


@asynccontextmanager
async def lifespan(app: FastAPI) -> Iterator[None]:
    limiter = anyio.to_thread.current_default_thread_limiter()
    limiter.total_tokens = 100
    yield


app = FastAPI(lifespan=lifespan)
```
