# AI-Hub

A production-grade Multi-Provider LLM Hub built with FastAPI and Pydantic stack.

## Project Structure

This project follows a feature-based architecture:

```text
ai-hub/
├── alembic/              # Database migration scripts
├── src/
│   ├── ai/               # AI gateway feature module
│   │   ├── providers/    # Provider adapters (OpenAI, Anthropic, Gemini)
│   │   ├── routing/      # Fallback, retry, and load-balancing strategies
│   │   ├── config.py     # AI module settings
│   │   ├── constants.py
│   │   ├── dependencies.py # HTTP client sessions & dependencies
│   │   ├── exceptions.py
│   │   ├── models.py     # AI DB models (usage, keys, logs)
│   │   ├── router.py     # FastAPI endpoints
│   │   ├── schemas.py    # Pydantic schemas
│   │   ├── service.py    # Gateway core service logic
│   │   └── utils.py
│   ├── auth/             # Auth & user management module
│   │   ├── config.py     # Auth module settings
│   │   ├── constants.py
│   │   ├── dependencies.py # User dependencies
│   │   ├── exceptions.py
│   │   ├── models.py     # Auth DB models
│   │   ├── router.py     # Auth endpoints
│   │   ├── schemas.py    # Auth Pydantic schemas
│   │   ├── service.py    # Auth business logic
│   │   └── utils.py
│   ├── config.py         # Global app settings
│   ├── database.py       # Async SQLAlchemy engine & session setup
│   ├── exceptions.py     # Base exceptions & error handlers
│   ├── main.py           # FastAPI app entrypoint & lifespan lifecycle
│   └── models.py         # Aggregate models for Alembic metadata
├── tests/                # Test suite
│   ├── conftest.py       # Global test fixtures & async DB setup
│   ├── ai/               # AI feature tests & provider mocks
│   └── auth/             # Auth feature tests
├── .env
├── .gitignore
└── alembic.ini
```