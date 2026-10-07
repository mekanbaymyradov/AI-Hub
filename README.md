# AI-Hub

A production-grade, multi-provider LLM chat API built with FastAPI and the Pydantic stack.

[![CI](https://github.com/mekanbaymyradov/AI-Hub/actions/workflows/ci.yml/badge.svg)](https://github.com/mekanbaymyradov/AI-Hub/actions/workflows/ci.yml)
[![Python](https://img.shields.io/python/required-version-toml?tomlFilePath=https://raw.githubusercontent.com/mekanbaymyradov/AI-Hub/main/pyproject.toml)](pyproject.toml)
[![License](https://img.shields.io/github/license/mekanbaymyradov/AI-Hub)](LICENSE)
[![Ruff](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/ruff/main/assets/badge/v2.json)](https://github.com/astral-sh/ruff)

**Status:** in active development, backend API only.

## Features

- Passwordless sign-in with emailed one-time codes and rotating refresh tokens
- Chat with Anthropic, OpenAI, Google and Groq models through one API
- Replies streamed over Server-Sent Events
- File attachments in private storage, with signed URLs and automatic cleanup
- Custom instructions, profile avatars, and paginated chat history

Under the hood: rate limiting, cursor pagination, structured JSON logs, Logfire
tracing, scheduled jobs and CI. See [Architecture](docs/architecture.md).

## Tech stack

- **API:** FastAPI, Pydantic
- **LLM:** Pydantic AI
- **Data:** PostgreSQL, SQLAlchemy (async), Alembic, Redis
- **Storage:** Cloudflare R2 (S3 API)
- **Email:** Resend
- **Observability:** Logfire, structlog
- **Tooling:** uv, Docker Compose, supercronic, GitHub Actions

## Getting started

Needs [Docker](https://docs.docker.com/get-docker/) and [uv](https://docs.astral.sh/uv/).

```bash
cp .env.example .env    # then fill in the keys, see docs/development.md
docker compose -f docker-compose.dev.yaml up --watch

# in a second terminal
uv run alembic upgrade head
```

Open the API docs at http://localhost:8000/docs. Run the tests with `uv run pytest`.

## Docs

- [Development guide](docs/development.md): configuration, migrations, jobs, tests
- [Deployment guide](docs/deployment.md): the production server, releases and rollback
- [Architecture](docs/architecture.md): how auth, streaming, attachments and the infrastructure work
- [Frontend guide](docs/frontend.md): where the frontend lives and how to run it against the API
- [Ideas](docs/ideas.md): possible features, not planned
- [Research notes](docs/RESEARCH.md)
