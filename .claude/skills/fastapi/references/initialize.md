# Project Initialization Guide

## 1. Install core development tools
- **uv** – fast dependency installer (`uv pip install -r requirements.txt`).
- **ruff** – linter/formatter (`ruff check .`).
- **ty** – type‑checking (`ty check .`).

## 2. Install `uvloop` and `httptools`

By default, Uvicorn doesn't come with `uvloop` and `httptools` which are faster than the default asyncio event loop and HTTP parser. Install them:

```bash
pip install uvloop httptools
```
Uvicorn will automatically use them if they are installed in your environment. (Note: `uvloop` can't be installed on Windows).

## 3. Use the `fastapi` CLI

Run the development server on localhost with reload:

```bash
fastapi dev
```

Run the production server:

```bash
fastapi run
```

Prefer declaring the entrypoint in `pyproject.toml`:

```toml
[tool.fastapi]
entrypoint = "my_app.main:app"
```

When adding the entrypoint is not possible, or the user explicitly asks not to, pass the app file path:

```bash
fastapi dev my_app/main.py
```