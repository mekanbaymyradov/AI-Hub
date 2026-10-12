from typing import Annotated

import httpx2
from fastapi import Depends, Request


async def get_http_client(request: Request) -> httpx2.AsyncClient:
    return request.state.http


HttpClientDep = Annotated[httpx2.AsyncClient, Depends(get_http_client)]
