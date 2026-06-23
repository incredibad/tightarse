import re
from bs4 import BeautifulSoup
from .base import BaseScraper, ScrapeResult

_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-AU,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Cache-Control": "max-age=0",
}

_PROXY_REQUIRED = (
    "Amazon scraping requires a VPN proxy to protect your home IP. "
    "Configure a Proxy URL in Settings → VPN."
)


class AmazonScraper(BaseScraper):
    store_name = "Amazon Australia"

    def __init__(self, proxy_url: str = ""):
        if not proxy_url:
            raise ValueError(_PROXY_REQUIRED)
        super().__init__(proxy_url=proxy_url)

    async def scrape_url(self, url: str) -> ScrapeResult:
        r = await self.client.get(url, headers=_HEADERS)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "lxml")

        name_el = soup.select_one("#productTitle")
        name = name_el.get_text(strip=True) if name_el else "Unknown product"

        price = _extract_price(soup)
        was_price = _extract_was_price(soup)
        on_special = was_price is not None and price is not None and was_price > price
        in_stock = price is not None

        cup_price, cup_label = _extract_cup_price(soup)
        package_size = _extract_package_size(soup, name)

        img_tag = soup.select_one("#landingImage")
        image_url = None
        if img_tag:
            image_url = img_tag.get("data-old-hires") or img_tag.get("src") or None

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

    async def search(self, query: str) -> list[dict]:
        return []


def _extract_price(soup: BeautifulSoup) -> float | None:
    # Primary: corePriceDisplay_desktop_feature_div
    for container_id in [
        "corePrice_feature_div",
        "corePriceDisplay_desktop_feature_div",
        "price_inside_buybox",
    ]:
        el = soup.select_one(f"#{container_id}")
        if el:
            whole = el.select_one(".a-price-whole")
            frac = el.select_one(".a-price-fraction")
            if whole:
                text = whole.get_text(strip=True).replace(",", "").rstrip(".")
                frac_text = frac.get_text(strip=True) if frac else "00"
                try:
                    return float(f"{text}.{frac_text}")
                except ValueError:
                    pass
    # Fallback: any a-price offscreen
    for el in soup.select(".a-price .a-offscreen"):
        text = el.get_text(strip=True).replace("$", "").replace(",", "").strip()
        try:
            return float(text)
        except ValueError:
            pass
    return None


def _extract_was_price(soup: BeautifulSoup) -> float | None:
    for el in soup.select(".a-text-price .a-offscreen"):
        text = el.get_text(strip=True).replace("$", "").replace(",", "").strip()
        try:
            return float(text)
        except ValueError:
            pass
    return None


def _extract_cup_price(soup: BeautifulSoup) -> tuple[float | None, str | None]:
    selectors = [
        "#price-per-unit",
        "#unit-count-and-price",
        "#corePrice_feature_div .a-price + span",
        "#corePrice_feature_div .a-size-small",
        "#apex_offerDisplay_desktop .a-size-small",
        "#corePriceDisplay_desktop_feature_div .a-size-small",
        ".unit-count-and-price",
        "#pricePerUnit",
        "#price-per-unit-message",
    ]
    for selector in selectors:
        el = soup.select_one(selector)
        if el:
            text = el.get_text(strip=True)
            result = _parse_unit_price(text)
            if result[0] is not None:
                return result

    # Broad fallback: scan the page for ($X.XX / unit) patterns in the price region
    price_region = soup.select_one("#centerCol, #ppd")
    if price_region:
        text = price_region.get_text(" ", strip=True)
        result = _parse_unit_price(text)
        if result[0] is not None:
            return result

    return None, None


def _parse_unit_price(text: str) -> tuple[float | None, str | None]:
    # Format: ($1.50 / Fl Oz) or ($0.06/count) or $1.50/Fl Oz
    m = re.search(r"\(?\$\s*([\d.]+)\s*/\s*([^)\s,]+(?:\s+[^)\s,]+)?)\)?", text)
    if m:
        try:
            return float(m.group(1)), f"per {m.group(2).lower().strip()}"
        except ValueError:
            pass
    # Format: $1.50 per Fl Oz / 1.50 per 100g
    m = re.search(r"\$\s*([\d.]+)\s+(per\s+\S+(?:\s+\S+)?)", text, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1)), m.group(2).lower().strip()
        except ValueError:
            pass
    return None, None


def _extract_package_size(soup: BeautifulSoup, name: str) -> str | None:
    size_el = soup.select_one("#size_name")
    if size_el:
        return size_el.get_text(strip=True) or None
    # Try to pull size from product name (e.g. "500g", "1L", "2 kg")
    m = re.search(r"\b(\d+(?:\.\d+)?\s*(?:kg|g|ml|l|L|pack|pk))\b", name, re.IGNORECASE)
    return m.group(1).strip() if m else None
