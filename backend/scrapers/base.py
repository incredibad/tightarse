import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import httpx


@dataclass
class ScrapeResult:
    name: str
    price: Optional[float]
    in_stock: bool
    store_name: str
    on_special: bool = False
    was_price: Optional[float] = None
    cup_price: Optional[float] = None
    cup_label: Optional[str] = None
    package_size: Optional[str] = None
    image_url: Optional[str] = None


class BaseScraper(ABC):
    """Abstract base class for all store scrapers.

    Each subclass handles one store. Implement `scrape_url` and `search`.
    """

    store_name: str = ""

    def __init__(self, proxy_url: str = ""):
        self.client = httpx.AsyncClient(
            timeout=15.0,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-AU,en;q=0.9",
            },
            follow_redirects=True,
            **({"proxy": proxy_url} if proxy_url else {}),
        )

    @abstractmethod
    async def scrape_url(self, url: str) -> ScrapeResult:
        """Fetch the product page/API for a known URL and return a ScrapeResult."""

    @abstractmethod
    async def search(self, query: str) -> list[dict]:
        """Search the store's own API/site.

        Returns a list of dicts with keys: name, price, url, store_name.
        """

    async def close(self):
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.close()


def infer_cup_price(name: str, price: float) -> tuple[float | None, str | None]:
    """Infer a unit price from size embedded in the product name when stores don't provide one."""
    # Volume: 950ml, 1L, 1.5L, 750mL
    m = re.search(r"([\d.]+)\s*(ml|l)\b", name, re.IGNORECASE)
    if m:
        qty = float(m.group(1))
        ml = qty * 1000 if m.group(2).lower() == "l" else qty
        return round(price / ml * 100, 4), "per 100ml"
    # Weight: 500g, 1kg, 1.5kg
    m = re.search(r"([\d.]+)\s*(kg|g)\b", name, re.IGNORECASE)
    if m:
        qty = float(m.group(1))
        grams = qty * 1000 if m.group(2).lower() == "kg" else qty
        return round(price / grams * 100, 4), "per 100g"
    return None, None
