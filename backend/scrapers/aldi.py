import re
import httpx
from bs4 import BeautifulSoup
from .base import BaseScraper, ScrapeResult


class ALDIScraper(BaseScraper):
    store_name = "ALDI"

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
        # ALDI AU does not expose a public search API; search via their site search page
        url = "https://www.aldi.com.au/en/groceries/"
        params = {"q": query}
        response = await self.client.get(url, params=params)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        results = []
        for card in soup.select(".product-tile, .product-grid-tile")[:20]:
            a_tag = card.select_one("a[href]")
            name_tag = card.select_one(".product-name, .tile-body h3")
            price_tag = card.select_one(".product-tile-price, .price")
            if not a_tag or not name_tag:
                continue
            href = a_tag["href"]
            product_url = href if href.startswith("http") else f"https://www.aldi.com.au{href}"
            price_text = price_tag.get_text(strip=True) if price_tag else ""
            price = _parse_price(price_text)
            results.append({
                "name": name_tag.get_text(strip=True),
                "price": price,
                "url": product_url,
                "store_name": self.store_name,
            })

        return results


def _extract_name(soup: BeautifulSoup) -> str:
    for selector in ["h1.product-name", "h1.product-detail-name", "h1"]:
        tag = soup.select_one(selector)
        if tag:
            return tag.get_text(strip=True)
    return "Unknown product"


def _extract_price(soup: BeautifulSoup) -> float | None:
    for selector in [".product-pricing .price", ".product-price", ".price"]:
        tag = soup.select_one(selector)
        if tag:
            return _parse_price(tag.get_text(strip=True))
    return None


def _extract_in_stock(soup: BeautifulSoup) -> bool:
    oos = soup.select_one(".out-of-stock, .sold-out, [class*='unavailable']")
    return oos is None


def _parse_price(text: str) -> float | None:
    match = re.search(r"\$?([\d,]+\.?\d*)", text.replace(",", ""))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None
