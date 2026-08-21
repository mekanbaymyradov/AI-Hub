# Architecture & Project Structure

## Compatibility Matrix

Pin to these versions or newer. Examples in this file assume them.

| Dependency       | Minimum   | Notes                                                |
|------------------|-----------|------------------------------------------------------|
| Python           | 3.11      | Required for `StrEnum` and `X \| Y` union syntax     |
| FastAPI          | 0.115     | `Annotated[T, Depends(...)]` is the idiomatic form   |
| Pydantic         | 2.7       | v1 APIs (`json_encoders`, `.dict()`) are removed     |
| pydantic-settings| 2.4       | Lives in a separate package since Pydantic v2        |
| SQLAlchemy       | 2.0       | Use the async API (`AsyncSession`, `async_sessionmaker`) |
| Alembic          | 1.13      | Async-aware migrations                               |
| httpx            | 0.27      | Use `ASGITransport` for in-process tests             |
| PyJWT            | 2.9       | Use this, not the unmaintained `python-jose`         |
| ruff             | 0.6       | Replaces black, isort, autoflake                     |

## Project Structure

Organize by domain, not by file type. One package per bounded context.

```
src/
├── {domain}/           # e.g., auth/, posts/, aws/
│   ├── router.py       # API endpoints
│   ├── schemas.py      # Pydantic models
│   ├── models.py       # SQLAlchemy ORM models
│   ├── service.py      # Business logic
│   ├── dependencies.py # Route dependencies
│   ├── config.py       # Domain-scoped BaseSettings
│   ├── constants.py    # Constants and error codes
│   ├── exceptions.py   # Domain-specific exceptions
│   └── utils.py        # Helper functions
├── config.py           # Global BaseSettings
├── models.py           # Shared Pydantic / ORM bases
├── exceptions.py       # Global exceptions
├── database.py         # Async engine + session factory
├── middleware.py       # Middleware
├── dependencies.py     # Shared dependencies
└── main.py             # FastAPI app + lifespan
```

**Cross-domain imports**: always use the explicit module name. Never `from src.auth import *`.

```python
from src.auth import constants as auth_constants
from src.notifications import service as notification_service
from src.posts.constants import ErrorCode as PostsErrorCode
```

