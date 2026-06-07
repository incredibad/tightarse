import re
import httpx
from bs4 import BeautifulSoup
from .base import BaseScraper, ScrapeResult


_SEARCH_API = "https://www.igashop.com.au/api/2.0/page/search"

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.igashop.com.au/",
}


class IGAScraper(BaseScraper):
    store_name = "IGA"

    async def scrape_url(self, url: str) -> ScrapeResult:
        response = await self.client.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        name = _extract_name(soup)
        price = _extract_price(soup)
        in_stock = _extract_in_stock(soup)

        return ScrapeResult(
            name=name,
            price=price,
            in_stock=in_stock,
            store_name=self.store_name,
        )

    async def search(self, query: str) -> list[dict]:
        params = {
            "q": query,
            "inStockOnly": "false",
            "useVariants": "true",
            "size": 20,
        }
        try:
            response = await self.client.get(_SEARCH_API, params=params, headers=_HEADERS)
            response.raise_for_status()
            data = response.json()
        except Exception:
            return []

        results = []
        for item in data.get("catalogEntryView", [])[:20]:
            name = item.get("name")
            product_id = item.get("partNumber") or item.get("uniqueID")
            price = None
            for offer in item.get("offerPrice", []):
                try:
                    price = float(offer.get("price", {}).get("amount", ""))
                    break
                except (ValueError, TypeError):
                    continue

            if not name or not product_id:
                continue

            seo_url = item.get("sEOURL", "")
            product_url = seo_url if seo_url.startswith("http") else f"https://www.igashop.com.au{seo_url}"
            results.append({
                "name": name,
                "price": price,
                "url": product_url,
                "store_name": self.store_name,
            })

        return results


def _extract_name(soup: BeautifulSoup) -> str:
    for selector in ["h1.product-name", "h1.pdp-title", "h1"]:
        tag = soup.select_one(selector)
        if tag:
            return tag.get_text(strip=True)
    return "Unknown product"


def _extract_price(soup: BeautifulSoup) -> float | None:
    for selector in [".price-display", ".product-price", "[data-testid='price']", ".price"]:
        tag = soup.select_one(selector)
        if tag:
            return _parse_price(tag.get_text(strip=True))
    return None


def _extract_in_stock(soup: BeautifulSoup) -> bool:
    oos = soup.select_one(".out-of-stock, .unavailable, [class*='outOfStock']")
    return oos is None


def _parse_price(text: str) -> float | None:
    match = re.search(r"\$?([\d,]+\.?\d*)", text.replace(",", ""))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None
