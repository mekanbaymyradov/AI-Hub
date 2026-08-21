# Dependencies

## Use Annotated, not default-arg `Depends(...)`

`Annotated[T, Depends(...)]` is the idiomatic form since FastAPI 0.95 and avoids
gotchas with default values.

```python
# DO — modern Annotated form
from typing import Annotated
from fastapi import Depends

PostDep = Annotated[dict, Depends(valid_post_id)]


@router.get("/posts/{post_id}")
async def get_post(post: PostDep):
    return post


# Avoid — default-argument form (still works, but legacy)
@router.get("/posts/{post_id}")
async def get_post(post: dict = Depends(valid_post_id)):
    return post
```

## Validate inside dependencies (not just inject)
```python
async def valid_post_id(post_id: UUID4) -> dict:
    post = await service.get_by_id(post_id)
    if not post:
        raise PostNotFound()
    return post
```

## Chain dependencies for reuse
```python
async def valid_owned_post(
    post: Annotated[dict, Depends(valid_post_id)],
    token_data: Annotated[dict, Depends(parse_jwt_data)],
) -> dict:
    if post["creator_id"] != token_data["user_id"]:
        raise UserNotOwner()
    return post
```

## Rules
- Dependencies are **cached per request**. Same `Depends(x)` called 5 times in one request → `x` runs once.
- Prefer `async def` dependencies. Sync deps run in the threadpool — wasted overhead for small CPU-only checks.
- Use **the same path-variable name** across endpoints when you want to share a dependency (e.g. `profile_id` in both `/profiles/{profile_id}` and `/creators/{profile_id}`).

# Dependency Injection

Use dependencies when:

* They can't be declared in Pydantic validation and require additional logic
* The logic depends on external resources or could block in any other way
* Other dependencies need their results (it's a sub-dependency)
* The logic can be shared by multiple endpoints to do things like error early, handle authentication, etc.
* They need to handle cleanup (e.g., DB sessions, file handles), using dependencies with `yield`
* Their logic needs input data from the request, like headers, query parameters, etc.

## Dependencies with `yield` and `scope`

When using dependencies with `yield`, they can have a `scope` that defines when the exit code is run.

Use the default scope `"request"` to run the exit code after the response is sent back.

```python
from typing import Annotated

from fastapi import Depends, FastAPI

app = FastAPI()


def get_db():
    db = DBSession()
    try:
        yield db
    finally:
        db.close()


DBDep = Annotated[DBSession, Depends(get_db)]


@app.get("/items/")
async def read_items(db: DBDep):
    return db.query(Item).all()
```

Use the scope `"function"` when they should run the exit code after the response data is generated but before the response is sent back to the client.

```python
from typing import Annotated

from fastapi import Depends, FastAPI

app = FastAPI()


def get_username():
    try:
        yield "Rick"
    finally:
        print("Clean up before response is sent")


UserNameDep = Annotated[str, Depends(get_username, scope="function")]


@app.get("/users/me")
def get_user_me(username: UserNameDep):
    return username
```

## Class Dependencies

Avoid creating class dependencies when possible.

If a class is needed, instead create a regular function dependency that returns a class instance.

Do this:

```python
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, FastAPI

app = FastAPI()


@dataclass
class DatabasePaginator:
    offset: int = 0
    limit: int = 100
    q: str | None = None

    def get_page(self) -> dict:
        # Simulate a page of data
        return {
            "offset": self.offset,
            "limit": self.limit,
            "q": self.q,
            "items": [],
        }


def get_db_paginator(
    offset: int = 0, limit: int = 100, q: str | None = None
) -> DatabasePaginator:
    return DatabasePaginator(offset=offset, limit=limit, q=q)


PaginatorDep = Annotated[DatabasePaginator, Depends(get_db_paginator)]


@app.get("/items/")
async def read_items(paginator: PaginatorDep):
    return paginator.get_page()
```

instead of this:

```python
# DO NOT DO THIS
from typing import Annotated

from fastapi import Depends, FastAPI

app = FastAPI()


class DatabasePaginator:
    def __init__(self, offset: int = 0, limit: int = 100, q: str | None = None):
        self.offset = offset
        self.limit = limit
        self.q = q

    def get_page(self) -> dict:
        # Simulate a page of data
        return {
            "offset": self.offset,
            "limit": self.limit,
            "q": self.q,
            "items": [],
        }


@app.get("/items/")
async def read_items(paginator: Annotated[DatabasePaginator, Depends()]):
    return paginator.get_page()
```

## Your dependencies may be running on threads

If the function is non-async and you use it as a dependency, it will run in a thread (using the thread pool). This incurs a performance penalty and can exhaust the thread pool if not careful.

```python
# DON'T: This will run in a thread
def http_client(request: Request) -> AsyncClient:
    return request.state.client


# DO: This will run in the asyncio event loop
async def http_client(request: Request) -> AsyncClient:
    return request.state.client
```

To run in the event loop, you need to make the function async. Always prefer async dependencies unless you are actually doing blocking I/O inside the dependency.
