import re
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
from .base import BaseScraper, ScrapeResult, infer_cup_price

_IMPERSONATE = "chrome124"


class ALDIScraper(BaseScraper):
    store_name = "ALDI"

    def __init__(self, proxy_url: str = ""):
        proxy_kwargs = {"proxies": {"https://": proxy_url, "http://": proxy_url}} if proxy_url else {}
        self._session = AsyncSession(impersonate=_IMPERSONATE, **proxy_kwargs)

    async def close(self):
        await self._session.close()

    async def scrape_url(self, url: str) -> ScrapeResult:
        response = await self._session.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        name = _extract_name(soup)
        price = _extract_price(soup)
        in_stock = price is not None
        cup_price, cup_label = _extract_cup_price(soup)
        package_size = _extract_package_size(soup)
        if cup_price is None and price is not None:
            cup_price, cup_label = infer_cup_price(name, price)

        img_tag = soup.select_one(".product-detail__image img, .product-image img, [class*='product-image'] img")
        image_url = None
        if img_tag:
            image_url = img_tag.get("src") or img_tag.get("data-src") or None
        return ScrapeResult(
            name=name,
            price=price,
            in_stock=in_stock,
            store_name=self.store_name,
            cup_price=cup_price,
            cup_label=cup_label,
            package_size=package_size,
            image_url=image_url,
        )

    async def search(self, query: str) -> list[dict]:
        url = "https://www.aldi.com.au/results"
        params = {"q": query}
        response = await self._session.get(url, params=params)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        headline = soup.select_one(".product-listing-viewer__headline")
        headline_text = headline.get_text(strip=True) if headline else ""
        if not headline_text.lower().startswith("results for"):
            return []

        results = []
        for card in soup.select(".product-tile"):
            a_tag = card.select_one("a.product-tile__link")
            brand_tag = card.select_one(".product-tile__brandname p")
            name_tag = card.select_one(".product-tile__name p")
            price_tag = card.select_one(".base-price__regular span")
            if not a_tag or not name_tag:
                continue
            href = a_tag["href"]
            product_url = href if href.startswith("http") else f"https://www.aldi.com.au{href}"
            brand = brand_tag.get_text(strip=True) if brand_tag else ""
            name = name_tag.get_text(strip=True)
            full_name = f"{brand} {name}".strip() if brand else name
            price = _parse_price(price_tag.get_text(strip=True)) if price_tag else None
            cup_price, cup_label = _extract_cup_price(card)
            if cup_price is None and price is not None:
                cup_price, cup_label = infer_cup_price(full_name, price)
            size_tag = card.select_one(".product-tile__unit-of-measurement")
            package_size = size_tag.get_text(strip=True) or None if size_tag else None
            img_tag = card.select_one("img")
            image_url = None
            if img_tag:
                image_url = img_tag.get("src") or img_tag.get("data-src") or None
            results.append({
                "name": full_name,
                "price": price,
                "url": product_url,
                "store_name": self.store_name,
                "cup_price": cup_price,
                "cup_label": cup_label,
                "package_size": package_size,
                "image_url": image_url,
            })

        return results


def _extract_name(soup: BeautifulSoup) -> str:
    for selector in ["h1.product-name", "h1.product-detail-name", "h1"]:
        tag = soup.select_one(selector)
        if tag:
            return tag.get_text(strip=True)
    return "Unknown product"


def _extract_price(soup: BeautifulSoup) -> float | None:
    tag = soup.select_one(".base-price__regular span")
    if tag:
        return _parse_price(tag.get_text(strip=True))
    return None



def _extract_package_size(soup: BeautifulSoup) -> str | None:
    tag = soup.select_one(".product-details__unit-of-measurement")
    if tag:
        text = tag.get_text(strip=True)
        # "0.5 kg ($15.98 per 1 kg)" — grab everything before the first "("
        size = re.split(r"\s*\(", text)[0].strip()
        return size or None
    return None


def _extract_cup_price(soup: BeautifulSoup) -> tuple[float | None, str | None]:
    for selector in [
        ".product-details__comparison-price",
        ".base-price__unit",
        "[class*='comparison-price']",
        "[class*='cup-price']",
        "[class*='unit-price']",
    ]:
        tag = soup.select_one(selector)
        if tag:
            text = tag.get_text(strip=True)
            # e.g. "($15.98 per 1 kg)" or "$2.49 per 100g"
            m = re.search(r"\$([\d.]+)\s+(per\s+[\d.]*\s*\w+)", text, re.IGNORECASE)
            if m:
                return float(m.group(1)), m.group(2).lower().strip()
    return None, None



def _parse_price(text: str) -> float | None:
    match = re.search(r"\$?([\d,]+\.?\d*)", text.replace(",", ""))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None
