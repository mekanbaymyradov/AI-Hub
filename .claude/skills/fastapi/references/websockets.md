# WebSockets

## Use `async for` instead of `while True`

Most examples on the internet use `while True` to read messages from the WebSocket. Instead, prefer `async for`, as it is cleaner and automatically catches the `WebSocketDisconnect` exception for you.

```py
from fastapi import FastAPI
from starlette.websockets import WebSocket

app = FastAPI()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    # DO - use async for
    async for data in websocket.iter_text():
        await websocket.send_text(f"Message text was: {data}")
```

## Ignore the `WebSocketDisconnect` exception

If you must use `while True`, you need to explicitly catch `WebSocketDisconnect`. With `async for`, it is caught automatically.

If you need to release resources when the WebSocket is disconnected, you can use that exception to do it.

```py
from fastapi import FastAPI
from starlette.websockets import WebSocket, WebSocketDisconnect

app = FastAPI()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(f"Message text was: {data}")
    except WebSocketDisconnect:
        # Client disconnected, release resources here
        pass
```
