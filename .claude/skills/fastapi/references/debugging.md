# Debugging and Profiling

## Enable AsyncIO debug mode

If you want to find the endpoints that are blocking the event loop, you can enable the AsyncIO debug mode.

When you enable it, Python will print a warning message when a task takes more than 100ms to execute.

Run your server with:
```bash
PYTHONASYNCIODEBUG=1 python main.py
```

```py
import time
from fastapi import FastAPI
import uvicorn

app = FastAPI()


@app.get("/")
async def read_root():
    time.sleep(1)  # Blocking call inside async route
    return {"Hello": "World"}


if __name__ == "__main__":
    uvicorn.run(app, loop="uvloop")
```

If you call the endpoint, you will see a warning message indicating the task took too long:

```bash
Executing <Task finished ...> took 1.009 seconds
```
