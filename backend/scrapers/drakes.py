import re
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from .base import BaseScraper, ScrapeResult

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.9",
}


def _extract_store_id(url: str) -> str:
    hostname = urlparse(url).hostname or ""
    m = re.match(r"^([^.]+)\.drakes\.com\.au$", hostname)
    return m.group(1) if m else "087"


def _parse_price(text: str) -> float | None:
    m = re.search(r"[\d]+\.[\d]{2}", text)
    if m:
        return float(m.group(0))
    m = re.search(r"[\d]+", text)
    return float(m.group(0)) if m else None


def _price_from_datalayer(html: str) -> float | None:
    for chunk in re.finditer(r"dataLayer\.push\s*\((.+?)\)\s*;", html, re.DOTALL):
        m = re.search(r'"price"\s*:\s*"?([\d.]+)"?', chunk.group(1))
        if m:
            return float(m.group(1))
    return None


def _extract_cup_price(soup: BeautifulSoup) -> tuple[float | None, str | None]:
    for selector in [
        "[class*='CupPrice']", "[class*='cup-price']",
        "[class*='UnitPrice']", "[class*='unit-price']",
        "[class*='PricePerUnit']", "[class*='price-per-unit']",
    ]:
        tag = soup.select_one(selector)
        if tag:
            text = tag.get_text(strip=True)
            m = re.search(r"\$([\d.]+)\s*(per\s+\S+)", text, re.IGNORECASE)
            if m:
                return float(m.group(1)), m.group(2).lower()
    return None, None


class DrakesScraper(BaseScraper):
    store_name = "Drakes"

    def __init__(self, store_id: str = "087", proxy_url: str = ""):
        super().__init__(proxy_url=proxy_url)
        self.store_id = store_id

    def _base(self, store_id: str | None = None) -> str:
        return f"https://{store_id or self.store_id}.drakes.com.au"

    async def search(self, query: str) -> list[dict]:
        base = self._base()
        r = await self.client.get(f"{base}/search", params={"q": query}, headers=_HEADERS)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")
        results = []

        for card in soup.select(".talker"):
            name_el = card.select_one(".talker__product-name")
            size_el = card.select_one(".talker__name__size")
            link_el = card.select_one("a[href]")
            price_el = card.select_one(".price__sell")

            if not name_el or not link_el:
                continue

            name = name_el.get_text(strip=True)
            if size_el:
                size = size_el.get_text(strip=True)
                if size:
                    name = f"{name} {size}"

            href = link_el.get("href", "")
            url = href if href.startswith("http") else f"{base}{href}"

            price = None
            if price_el:
                price = _parse_price(price_el.get_text())

            cup_price, cup_label = None, None
            cup_el = card.select_one(".talker__prices__comparison--UnitPrice")
            if cup_el:
                m = re.search(r"\$([\d.]+)\s+(per\s+\S+)", cup_el.get_text(strip=True), re.IGNORECASE)
                if m:
                    cup_price = float(m.group(1))
                    cup_label = m.group(2).lower()

            package_size = size_el.get_text(strip=True) or None if size_el else None

            img_tag = card.select_one("img")
            image_url = None
            if img_tag:
                src = img_tag.get("src") or img_tag.get("data-src") or None
                if src:
                    image_url = src if src.startswith("http") else f"{base}{src}"
            results.append({"name": name, "price": price, "url": url, "store_name": self.store_name,
                            "cup_price": cup_price, "cup_label": cup_label, "package_size": package_size,
                            "image_url": image_url})

        return results

    async def scrape_url(self, url: str) -> ScrapeResult:
        r = await self.client.get(url, headers=_HEADERS)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        name_el = (
            soup.select_one("h1.ProductDetail__Name")
            or soup.select_one("[class*='ProductDetail__Name']")
            or soup.select_one("h1")
        )
        name = name_el.get_text(strip=True) if name_el else "Unknown product"

        # Try GA4 dataLayer first, then CSS class
        price = _price_from_datalayer(r.text)
        if price is None:
            price_el = soup.select_one(
                ".ProductDetail__Price__Current, [class*='Price__Current'], [class*='price-current']"
            )
            if price_el:
                price = _parse_price(price_el.get_text())

        in_stock = price is not None
        cup_price, cup_label = _extract_cup_price(soup)
        size_tag = soup.select_one(".ProductDetail__Title .weak, h1 .weak")
        package_size = size_tag.get_text(strip=True) or None if size_tag else None
        if not package_size:
            # Variable-weight products show "per 300g" in the sell unit element
            sell_unit = soup.select_one("[class*='SellUnit']")
            if sell_unit:
                text = sell_unit.get_text(strip=True)
                m = re.search(r"per\s+([\d.]+\s*[a-zA-Z]+)", text, re.IGNORECASE)
                if m:
                    package_size = m.group(1).strip()

        was_price = None
        was_el = soup.select_one("[class*='ProductDetail__Price__Was']")
        if was_el:
            was_price = _parse_price(was_el.get_text())
        on_special = was_price is not None and price is not None and was_price > price

        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        img_tag = soup.select_one("[class*='ProductDetail__Image'] img, [class*='product-detail'] img, .gallery img")
        image_url = None
        if img_tag:
            src = img_tag.get("src") or img_tag.get("data-src")
            if src:
                image_url = src if src.startswith("http") else f"{base_url}{src}"

        return ScrapeResult(
            name=name,
            price=price,
            in_stock=in_stock,
            store_name=self.store_name,
            on_special=on_special,
            was_price=was_price if on_special else None,
            cup_price=cup_price,
            cup_label=cup_label,
            package_size=package_size,
            image_url=image_url,
        )
