import asyncio
import json
import os
import re
import tempfile
from urllib.parse import urlencode

from .base import BaseScraper, ScrapeResult

_HOME = "https://www.woolworths.com.au"
_API_BASE = f"{_HOME}/apis/ui"
_PRODUCT_API = f"{_API_BASE}/product/detail"
_SEARCH_API = f"{_API_BASE}/Search/products"

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def _extract_stockcode(url: str) -> str | None:
    match = re.search(r"/productdetails/(\d+)", url)
    return match.group(1) if match else None


def _multibuy(product: dict) -> dict:
    """Return price/deal overrides when a multi-buy promotion is present (e.g. '2 for $10')."""
    mb = (product.get("CentreTag") or {}).get("MultibuyData")
    if not mb:
        return {}
    qty = mb.get("Quantity")
    total = mb.get("Price")
    if not qty or not total:
        return {}
    per_unit = round(total / qty, 2)
    single = product.get("Price") or product.get("WasPrice")
    out = {
        "price": per_unit,
        "on_special": True,
        "was_price": float(single) if single else None,
    }
    # Parse multibuy cup price e.g. "$2.89/100G"
    m = re.search(r"\$([\d.]+)/(.+)", mb.get("CupTag") or "")
    if m:
        out["cup_price"] = float(m.group(1))
        out["cup_label"] = f"per {m.group(2).strip().lower()}"
    return out


class WoolworthsScraper(BaseScraper):
    store_name = "Woolworths"

    def __init__(self, proxy_url: str = ""):
        super().__init__(proxy_url=proxy_url)
        self._cookie_jar = tempfile.mktemp(suffix="_ww.txt")
        self._session_ready = False

    async def _ensure_session(self):
        """Visit the homepage to get a valid session cookie Woolworths requires on its APIs."""
        if self._session_ready:
            return
        proc = await asyncio.create_subprocess_exec(
            "curl", "-sL", "--max-time", "15",
            "-c", self._cookie_jar,
            "-H", f"User-Agent: {_UA}",
            "-H", "Accept: text/html",
            "-H", "Accept-Language: en-AU,en;q=0.9",
            _HOME,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.communicate(), timeout=20)
        self._session_ready = True

    async def _get(self, url: str, params: dict | None = None) -> dict:
        await self._ensure_session()
        if params:
            url = f"{url}?{urlencode(params)}"
        proc = await asyncio.create_subprocess_exec(
            "curl", "-s", "--max-time", "15",
            "-b", self._cookie_jar,
            "-H", f"User-Agent: {_UA}",
            "-H", "Accept: application/json, text/plain, */*",
            "-H", "Accept-Language: en-AU,en;q=0.9",
            "-H", f"Referer: {_HOME}/",
            "-H", f"Origin: {_HOME}",
            "-H", "x-requested-with: OnlineShop",
            url,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
        return json.loads(stdout)

    async def scrape_url(self, url: str) -> ScrapeResult:
        stockcode = _extract_stockcode(url)
        if not stockcode:
            raise ValueError(f"Cannot extract stockcode from URL: {url}")

        data = await self._get(f"{_PRODUCT_API}/{stockcode}")
        product = data.get("Product", {})
        name = product.get("Name", "Unknown product")
        in_stock = not product.get("IsOutOfStock", False)
        package_size = (product.get("PackageSize") or "").strip() or None

        mb = _multibuy(product)
        on_special = mb.get("on_special", product.get("IsOnSpecial", False))
        price = mb.get("price") or product.get("Price") or product.get("WasPrice")
        was_price = mb.get("was_price") if mb else (
            product.get("WasPrice") if on_special else None
        )
        cup_price_raw = product.get("CupPrice")
        cup_measure = (product.get("CupMeasure") or "").strip()
        cup_price = mb.get("cup_price") or (float(cup_price_raw) if cup_price_raw is not None else None)
        cup_label = mb.get("cup_label") or (f"per {cup_measure.lower()}" if cup_measure else None)

        image_url = (
            product.get("LargeImageFile")
            or product.get("SmallImageFile")
            or f"https://cdn0.woolworths.media/content/wowproductimages/large/{stockcode}.jpg"
        )
        return ScrapeResult(
            name=name,
            price=float(price) if price is not None else None,
            in_stock=in_stock,
            store_name=self.store_name,
            on_special=on_special,
            was_price=was_price,
            cup_price=cup_price,
            cup_label=cup_label,
            package_size=package_size,
            image_url=image_url,
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
        data = await self._get(_SEARCH_API, params=params)

        results = []
        for bundle in data.get("Products", []):
            for p in bundle.get("Products", [bundle]):
                stockcode = p.get("Stockcode")
                name = p.get("Name")
                price = p.get("Price") or p.get("WasPrice")
                if not stockcode or not name:
                    continue
                cup_price_raw = p.get("CupPrice")
                cup_measure = (p.get("CupMeasure") or "").strip().lower()
                package_size = (p.get("PackageSize") or "").strip() or None
                mb = _multibuy(p)
                image_url = (
                    p.get("LargeImageFile")
                    or p.get("SmallImageFile")
                    or f"https://cdn0.woolworths.media/content/wowproductimages/large/{stockcode}.jpg"
                )
                results.append({
                    "name": name,
                    "price": mb.get("price") or (float(price) if price is not None else None),
                    "url": f"{_HOME}/shop/productdetails/{stockcode}",
                    "store_name": self.store_name,
                    "cup_price": mb.get("cup_price") or (float(cup_price_raw) if cup_price_raw is not None else None),
                    "cup_label": mb.get("cup_label") or (f"per {cup_measure}" if cup_measure else None),
                    "package_size": package_size,
                    "image_url": image_url,
                })

        return results

    async def close(self):
        await super().close()
        try:
            os.unlink(self._cookie_jar)
        except FileNotFoundError:
            pass
