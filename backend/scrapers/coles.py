import asyncio
import os
import re
import httpx
from .base import BaseScraper, ScrapeResult, infer_cup_price

_BASE = "https://www.coles.com.au"

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# Store ID used for pricing lookups. Coles' SSR only returns pricing when a
# fulfillmentStoreId cookie is present. Set COLES_STORE_ID env var to override.
_STORE_ID = os.environ.get("COLES_STORE_ID", "4670")

# Headers for JSON API calls (XHR/fetch)
_API_HEADERS = {
    "User-Agent": _UA,
    "Accept": "application/json",
    "Accept-Language": "en-AU,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-site": "same-origin",
    "sec-fetch-mode": "cors",
    "sec-fetch-dest": "empty",
}


def _extract_slug(url: str) -> str | None:
    qp = re.search(r"[?&]productId=(\d+)", url)
    if qp:
        return qp.group(1)
    slug = re.search(r"/product/([^?#/]+)", url)
    return slug.group(1) if slug else None


class ColesScraper(BaseScraper):
    store_name = "Coles"
    _build_id: str | None = None

    async def _get_build_id(self) -> str:
        """Fetch the current Next.js buildId via curl (bypasses TLS fingerprint detection).

        Uses the api/2.0/market/products URL which is not behind the Imperva JS challenge
        that blocks the search/products page, but still returns a Next.js HTML shell
        containing the buildId.
        """
        proc = await asyncio.create_subprocess_exec(
            "curl", "-sL",
            "-H", f"User-Agent: {_UA}",
            "-H", "Accept: application/json",
            "-H", "Accept-Language: en-AU,en;q=0.9",
            f"{_BASE}/api/2.0/market/products?q=a&pageNumber=1&pageSize=1",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=20)
        m = re.search(rb'"buildId"\s*:\s*"([^"]+)"', stdout)
        if not m:
            raise ValueError("Could not find Coles buildId")
        self._build_id = m.group(1).decode()
        return self._build_id

    async def _build_url(self, path: str) -> str:
        build_id = self._build_id or await self._get_build_id()
        return f"{_BASE}/_next/data/{build_id}/{path}"

    async def search(self, query: str) -> list[dict]:
        url = await self._build_url("search/products.json")
        r = await self.client.get(
            url,
            params={"q": query, "page": 1},
            headers={**_API_HEADERS, "Referer": f"{_BASE}/search/products?q={query}"},
        )
        if r.status_code == 404:
            # buildId stale — refresh and retry once
            self._build_id = None
            url = await self._build_url("search/products.json")
            r = await self.client.get(
                url,
                params={"q": query, "page": 1},
                headers={**_API_HEADERS, "Referer": f"{_BASE}/search/products?q={query}"},
            )
        r.raise_for_status()

        raw = r.json().get("pageProps", {}).get("searchResults", {}).get("results", [])
        results = []
        for p in raw:
            if p.get("_type") != "PRODUCT":
                continue
            name = _full_name(p)
            product_id = p.get("id")
            pricing = p.get("pricing") or {}
            price = pricing.get("now") or pricing.get("was")
            if not name or not product_id:
                continue
            # Coles canonical product URL uses name-slug + id
            slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
            package_size = (p.get("size") or "").strip() or None
            mb = _multibuy_coles(pricing)
            cup_price_base, cup_label_base = _extract_cup_price(pricing)
            image_url = _extract_image_url(p.get("imageUris"))
            p_cup = mb.get("cup_price", cup_price_base)
            p_label = mb.get("cup_label", cup_label_base)
            p_price = mb.get("price") or (float(price) if price is not None else None)
            if p_cup is None and p_price is not None:
                p_cup, p_label = infer_cup_price(name, p_price)
            results.append({
                "name": name,
                "price": p_price,
                "url": f"{_BASE}/product/{slug}-{product_id}",
                "store_name": self.store_name,
                "cup_price": p_cup,
                "cup_label": p_label,
                "package_size": package_size,
                "image_url": image_url,
            })
        return results

    async def scrape_url(self, url: str) -> ScrapeResult:
        slug = _extract_slug(url)
        if not slug:
            raise ValueError(f"Cannot extract product slug from URL: {url}")

        # The fulfillmentStoreId cookie is required for Coles' SSR to enrich
        # product pricing — without it, PAY ON SCAN and some other products
        # return pricing: null in the _next/data JSON response.
        store_cookie = f"fulfillmentStoreId={_STORE_ID}"

        next_url = await self._build_url(f"product/{slug}.json")
        r = await self.client.get(
            next_url,
            headers={**_API_HEADERS, "Referer": url, "Cookie": store_cookie},
        )
        if r.status_code == 404:
            self._build_id = None
            next_url = await self._build_url(f"product/{slug}.json")
            r = await self.client.get(
                next_url,
                headers={**_API_HEADERS, "Referer": url, "Cookie": store_cookie},
            )
        r.raise_for_status()

        data = r.json().get("pageProps", {})
        # Coles returns __N_REDIRECT (Next.js internal redirect) when the slug
        # doesn't match the canonical form (e.g. apostrophes become hyphens in
        # some URLs but Coles canonicalises to the apostrophe form).
        redirect_path = data.get("__N_REDIRECT")
        if redirect_path:
            new_slug_m = re.search(r"/product/([^?#/]+)", redirect_path)
            if new_slug_m:
                slug = new_slug_m.group(1)
                next_url = await self._build_url(f"product/{slug}.json")
                r = await self.client.get(
                    next_url,
                    headers={**_API_HEADERS, "Referer": f"{_BASE}/product/{slug}", "Cookie": store_cookie},
                )
                r.raise_for_status()
                data = r.json().get("pageProps", {})

        product = data.get("product") or {}

        name = _full_name(product) or "Unknown product"
        pricing = product.get("pricing") or {}
        on_special = pricing.get("promotionType") == "SPECIAL"
        now = pricing.get("now")
        was = pricing.get("was")
        in_stock = product.get("availability", True)
        package_size = (product.get("size") or "").strip() or None

        mb = _multibuy_coles(pricing)
        price = mb.get("price") or (now if now is not None else was)
        on_special = mb.get("on_special", on_special)
        was_price = mb.get("was_price") if mb else (float(was) if on_special and was else None)
        cup_price_base, cup_label_base = _extract_cup_price(pricing)
        cup_price = mb.get("cup_price", cup_price_base)
        cup_label = mb.get("cup_label", cup_label_base)
        if cup_price is None and price is not None:
            cup_price, cup_label = infer_cup_price(name, float(price))

        image_url = _extract_image_url(product.get("imageUris"))
        return ScrapeResult(
            name=name,
            price=float(price) if price is not None else None,
            in_stock=bool(in_stock),
            store_name=self.store_name,
            on_special=on_special,
            was_price=was_price,
            cup_price=cup_price,
            cup_label=cup_label,
            package_size=package_size,
            image_url=image_url,
        )


def _multibuy_coles(pricing: dict) -> dict:
    """Return price/cup overrides when a Coles multi-buy promotion is present."""
    mb = pricing.get("multiBuyPromotion")
    if not mb:
        return {}
    reward = mb.get("reward")
    if reward is None:
        return {}
    out = {
        "price": float(reward),
        "on_special": True,
        "was_price": float(pricing.get("now") or 0) or None,
    }
    # unitPriceDisplay e.g. "$3.85/ 100g"
    unit_display = mb.get("unitPriceDisplay") or ""
    m = re.search(r"\$([\d.]+)\s*[/]\s*(.+)", unit_display)
    if m:
        out["cup_price"] = float(m.group(1))
        out["cup_label"] = f"per {m.group(2).strip().lower()}"
    return out


def _full_name(p: dict) -> str:
    """Combine brand + name + size into a readable product name."""
    parts = [p.get("brand", ""), p.get("name", ""), p.get("size", "")]
    return " ".join(x for x in parts if x).strip()


def _extract_cup_price(pricing: dict) -> tuple[float | None, str | None]:
    """Extract the per-unit (cup) price from a Coles pricing dict."""
    # comparable e.g. "$18.00/ 1kg" or "$5.83 per 100g" — normalise both separators
    comparable = pricing.get("comparable") or ""
    m = re.search(r"\$([\d.]+)\s*(?:per\s+|/\s*)(.+)", comparable, re.IGNORECASE)
    if m:
        return float(m.group(1)), f"per {m.group(2).strip()}"

    # Fall back to structured unit fields
    unit = pricing.get("unit") or {}
    unit_price = unit.get("price")
    qty = unit.get("ofMeasureQuantity")
    units = unit.get("ofMeasureUnits") or ""
    if unit_price is not None and units:
        label = f"per {units}" if not qty or qty == 1 else f"per {qty}{units}"
        return float(unit_price), label

    return None, None


_IMAGE_BASE = "https://productimages.coles.com.au/productimages"


def _extract_image_url(image_uris) -> str | None:
    if not image_uris:
        return None
    for entry in image_uris:
        uri = entry.get("uri") if isinstance(entry, dict) else None
        if uri:
            return uri if uri.startswith("http") else f"{_IMAGE_BASE}{uri}"
    return None
