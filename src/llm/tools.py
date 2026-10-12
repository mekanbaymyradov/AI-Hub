from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx2
from pydantic_ai import FunctionToolset, ModelRetry, RunContext, ToolFailed
from pydantic_ai.capabilities import WebSearch
from pydantic_ai.native_tools import WebSearchTool

from src.llm.constants import FORECAST_URL, GEOCODING_URL, WEATHER_CODES
from src.llm.enums import Provider
from src.llm.models import AgentDeps

# Docstrings here are the tool descriptions the model reads, so they are
# written for it.
toolset = FunctionToolset[AgentDeps]()


@toolset.tool_plain
def get_current_time(timezone: str = "UTC") -> str:
    """Return the current date and time.

    Args:
        timezone: An IANA timezone, like "Asia/Ashgabat".
    """
    try:
        zone = ZoneInfo(timezone)
    # ValueError is for strings that cannot be a key at all, like "" or "../x".
    except ZoneInfoNotFoundError, ValueError:
        raise ModelRetry(
            f"Unknown timezone {timezone!r}. Use an IANA name like 'Europe/Berlin'."
        ) from None
    return datetime.now(zone).strftime("%A, %Y-%m-%d %H:%M %Z (UTC%z)")


@dataclass
class Weather:
    place: str
    temperature_c: float
    feels_like_c: float
    wind_kmh: float
    conditions: str


@toolset.tool
async def get_weather(ctx: RunContext[AgentDeps], city: str) -> Weather:
    """Return the current weather in a city.

    Args:
        city: The city name alone, like "Paris", without region or country.
    """
    http = ctx.deps.http
    try:
        # The geocoder matches bare names only; "Paris, France" finds nothing.
        response = await http.get(GEOCODING_URL, params={"name": city, "count": 1})
        response.raise_for_status()
        places = response.json().get("results")
        if not places:
            raise ModelRetry(
                f"No place named {city!r}. Try the city's English name alone."
            )
        place = places[0]

        response = await http.get(
            FORECAST_URL,
            params={
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "current": (
                    "temperature_2m,apparent_temperature,weather_code,wind_speed_10m"
                ),
            },
        )
        response.raise_for_status()
    except httpx2.HTTPError as exc:
        raise ToolFailed("The weather service is unavailable.") from exc

    current = response.json()["current"]
    return Weather(
        place=", ".join(filter(None, [place["name"], place.get("country")])),
        temperature_c=current["temperature_2m"],
        feels_like_c=current["apparent_temperature"],
        wind_kmh=current["wind_speed_10m"],
        conditions=WEATHER_CODES.get(current["weather_code"], "unknown"),
    )


def _native_web_search(ctx: RunContext[AgentDeps]) -> WebSearchTool | None:
    """Return the provider's own search, or None to search with DuckDuckGo instead."""
    if ctx.model.system in (Provider.ANTHROPIC, Provider.GOOGLE):
        return WebSearchTool()
    return None


web_search = WebSearch(native=_native_web_search, local="duckduckgo")
