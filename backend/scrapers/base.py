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
