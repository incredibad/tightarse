import re
import httpx
from .base import BaseScraper, ScrapeResult


_API_BASE = "https://www.coles.com.au/api/2.0"
_PRODUCT_API = f"{_API_BASE}/product"
_SEARCH_API = f"{_API_BASE}/search"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-AU,en;q=0.9",
    "Referer": "https://www.coles.com.au/",
    "Origin": "https://www.coles.com.au",
    "ocp-apim-subscription-key": "5da11a86b7434c3a87c32a276c3a7b51",
}


def _extract_product_id(url: str) -> str | None:
    """Extract the product ID from a Coles product URL.

    Handles forms like:
      /product/some-product-name-1234567
      /browse/dairy-eggs-fridge/...?productId=1234567
    """
    # Try query param first
    qp = re.search(r"[?&]productId=(\d+)", url)
    if qp:
        return qp.group(1)
    # Try slug suffix (last numeric segment)
    slug = re.search(r"-(\d{5,})(?:\?|$|/)", url)
    return slug.group(1) if slug else None


class ColesScraper(BaseScraper):
    store_name = "Coles"

    async def scrape_url(self, url: str) -> ScrapeResult:
        product_id = _extract_product_id(url)
        if not product_id:
            raise ValueError(f"Cannot extract product ID from URL: {url}")

        api_url = f"{_PRODUCT_API}/{product_id}"
        response = await self.client.get(api_url, headers=_HEADERS)
        response.raise_for_status()
        data = response.json()

        name = data.get("name", "Unknown product")
        pricing = data.get("pricing", {})
        price = pricing.get("now") or pricing.get("was")
        in_stock = data.get("availability", {}).get("isInStock", True)

        return ScrapeResult(
            name=name,
            price=float(price) if price is not None else None,
            in_stock=in_stock,
            store_name=self.store_name,
        )

    async def search(self, query: str) -> list[dict]:
        params = {
            "q": query,
            "page": 1,
            "pageSize": 20,
        }
        response = await self.client.get(_SEARCH_API, params=params, headers=_HEADERS)
        response.raise_for_status()
        data = response.json()

        results = []
        for p in data.get("results", []):
            product_id = p.get("id")
            name = p.get("name")
            pricing = p.get("pricing", {})
            price = pricing.get("now") or pricing.get("was")
            if not product_id or not name:
                continue
            # Build canonical URL from the product slug if available
            slug = p.get("slug", str(product_id))
            results.append({
                "name": name,
                "price": float(price) if price is not None else None,
                "url": f"https://www.coles.com.au/product/{slug}",
                "store_name": self.store_name,
            })

        return results
