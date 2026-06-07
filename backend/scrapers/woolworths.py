import re
import httpx
from .base import BaseScraper, ScrapeResult


# Woolworths internal API endpoints (reverse-engineered from app traffic)
_API_BASE = "https://www.woolworths.com.au/apis/ui"
_PRODUCT_API = f"{_API_BASE}/product/detail"
_SEARCH_API = f"{_API_BASE}/Search/products"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-AU,en;q=0.9",
    "Referer": "https://www.woolworths.com.au/",
    "Origin": "https://www.woolworths.com.au",
    "x-requested-with": "OnlineShop",
}


def _extract_stockcode(url: str) -> str | None:
    """Extract the numeric stockcode from a Woolworths product URL.

    Handles forms like:
      /shop/productdetails/12345/some-product-name
      /shop/productdetails/12345
    """
    match = re.search(r"/productdetails/(\d+)", url)
    return match.group(1) if match else None


class WoolworthsScraper(BaseScraper):
    store_name = "Woolworths"

    async def scrape_url(self, url: str) -> ScrapeResult:
        stockcode = _extract_stockcode(url)
        if not stockcode:
            raise ValueError(f"Cannot extract stockcode from URL: {url}")

        api_url = f"{_PRODUCT_API}/{stockcode}"
        response = await self.client.get(api_url, headers=_HEADERS)
        response.raise_for_status()
        data = response.json()

        product = data.get("Product", {})
        name = product.get("Name", "Unknown product")
        price = product.get("Price") or product.get("WasPrice")
        in_stock = not product.get("IsOutOfStock", False)

        return ScrapeResult(
            name=name,
            price=float(price) if price is not None else None,
            in_stock=in_stock,
            store_name=self.store_name,
        )

    async def search(self, query: str) -> list[dict]:
        params = {
            "searchTerm": query,
            "pageNumber": 1,
            "pageSize": 20,
            "sortType": "TraderRelevance",
            "isMobile": "false",
            "filters": "[]",
            "token": "",
            "gpBoost": 0,
            "isHideUnavailableProducts": "false",
            "isRegisteredRewardCardPromotion": "false",
            "enableAdReRanking": "false",
        }
        response = await self.client.get(_SEARCH_API, params=params, headers=_HEADERS)
        response.raise_for_status()
        data = response.json()

        results = []
        bundles = data.get("Products", [])
        for bundle in bundles:
            # Each bundle may contain a Products list or a single product
            products = bundle.get("Products", [bundle])
            for p in products:
                stockcode = p.get("Stockcode")
                name = p.get("Name")
                price = p.get("Price") or p.get("WasPrice")
                if not stockcode or not name:
                    continue
                results.append({
                    "name": name,
                    "price": float(price) if price is not None else None,
                    "url": f"https://www.woolworths.com.au/shop/productdetails/{stockcode}",
                    "store_name": self.store_name,
                })

        return results
