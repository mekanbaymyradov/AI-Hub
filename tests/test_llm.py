import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio


async def test_models_returns_available_models(client: AsyncClient):
    response = await client.get("/llms/models")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": "groq:test-model",
            "provider": "groq",
            "display_name": "Test Model",
            "supports_files": True,
        }
    ]
