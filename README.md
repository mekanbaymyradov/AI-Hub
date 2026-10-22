# AI-Hub

A production-grade, multi-provider LLM chat API built with FastAPI and the Pydantic stack.

[![CI](https://github.com/mekanbaymyradov/AI-Hub/actions/workflows/ci.yml/badge.svg)](https://github.com/mekanbaymyradov/AI-Hub/actions/workflows/ci.yml)
[![Python](https://img.shields.io/python/required-version-toml?tomlFilePath=https://raw.githubusercontent.com/mekanbaymyradov/AI-Hub/main/pyproject.toml)](pyproject.toml)
[![License](https://img.shields.io/github/license/mekanbaymyradov/AI-Hub)](LICENSE)
[![Ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)

**Live:** [ai-hub.techship.fun](https://ai-hub.techship.fun/)

**Status:** in active development. The API and the web app deploy together.

This project was highly inspired by:

- [Netflix Dispatch](https://github.com/Netflix/dispatch/tree/main/src/dispatch): the architecture, one package per domain
- [FastAPI Best Practices](https://github.com/zhanymkanov/fastapi-best-practices): project structure and conventions by [@zhanymkanov](https://github.com/zhanymkanov)
- [FastAPI Tips](https://github.com/Kludex/fastapi-tips): tips from [@Kludex](https://github.com/Kludex), the FastAPI expert

## TODO

- [ ] Add docs for self-hosting
- [ ] Refactor
- [ ] Send voice messages
- [ ] Generate images
- [ ] Retry sending a message
- [ ] Edit messages

## Features

- Passwordless sign-in with emailed one-time codes and rotating refresh tokens
- Chat with Anthropic, OpenAI, Google, Groq and Mistral models through one API
- Replies streamed over Server-Sent Events
- Tool calling for the current time and weather, with the running tool shown in the chat
- Web search: the provider's built-in search on Anthropic and Google, DuckDuckGo on the rest
- File attachments in private storage, with signed URLs and automatic cleanup
- Custom instructions, profile avatars, and paginated chat history

Under the hood: rate limiting, cursor pagination, Logfire tracing and logs,
scheduled jobs and CI. See [Architecture](docs/architecture.md).

## Tech stack

- **API:** FastAPI, Pydantic
- **LLM:** Pydantic AI
- **Data:** PostgreSQL, SQLAlchemy (async), Alembic, Redis
- **Storage:** Cloudflare R2 (S3 API)
- **Email:** Resend
- **Observability:** Logfire
- **Tooling:** uv, Docker Compose, supercronic, GitHub Actions

## Getting started

Needs [Docker](https://docs.docker.com/get-docker/) and [uv](https://docs.astral.sh/uv/).

```bash
cp .env.example .env    # then fill in the keys, see docs/development.md
docker compose -f docker-compose.dev.yaml --profile frontend up --watch

# in a second terminal
uv run alembic upgrade head
```

- App: http://localhost:5173
- API docs: http://localhost:8000/docs

Run the tests with `uv run pytest`.

## Docs

- [Development guide](docs/development.md): configuration, migrations, jobs, tests
- [Architecture](docs/architecture.md): how auth, streaming, attachments and the infrastructure work
- [Ideas](docs/ideas.md): possible features, not planned
- [Research notes](docs/RESEARCH.md)
