import asyncio
import json
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Store, Setting, get_global_setting
from auth import require_auth, require_admin, User
from scrapers import supports_search

router = APIRouter(prefix="/stores", tags=["stores"])

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


class StoreOut(BaseModel):
    id: int
    name: str
    base_url: str
    scraper_module: str
    supports_search: bool = False
    enabled: bool = True
    priority: int = 0
    available: bool = True

    class Config:
        from_attributes = True


def _enrich_store(s: Store, vpn_proxy_url: str = "") -> StoreOut:
    out = StoreOut.model_validate(s)
    out.supports_search = supports_search(s.scraper_module)
    out.enabled = bool(s.enabled) if s.enabled is not None else True
    out.priority = s.priority if s.priority is not None else 0
    out.available = not (s.scraper_module == "amazon" and not vpn_proxy_url)
    return out


@router.get("/", response_model=list[StoreOut])
def list_stores(_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    stores = db.query(Store).order_by(Store.priority, Store.name).all()
    vpn_proxy_url = get_global_setting(db, "vpn_proxy_url")
    return [_enrich_store(s, vpn_proxy_url) for s in stores]


@router.patch("/{store_id}", response_model=StoreOut)
def update_store(store_id: int, payload: dict, _admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    if "enabled" in payload:
        store.enabled = payload["enabled"]
    db.commit()
    db.refresh(store)
    return _enrich_store(store)


class ReorderPayload(BaseModel):
    order: list[int]


@router.post("/reorder", status_code=204)
def reorder_stores(payload: ReorderPayload, _admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    for priority, store_id in enumerate(payload.order):
        store = db.query(Store).filter(Store.id == store_id).first()
        if store:
            store.priority = priority
    db.commit()


class DrakeStoreResult(BaseModel):
    id: str
    name: str
    url: str
    working: bool


def _find_store_name(a_tag) -> str:
    """Walk up the DOM from a Shop Now link to find the store's display name."""
    for parent in a_tag.parents:
        for tag in ["h1", "h2", "h3", "h4", "h5"]:
            heading = parent.find(tag)
            if heading:
                text = heading.get_text(strip=True)
                if text and text.lower() not in ("shop now", "store info", "delivery", "click & collect"):
                    return text
        for cls_pattern in [r"store.?name", r"title", r"heading", r"name"]:
            el = parent.find(class_=re.compile(cls_pattern, re.I))
            if el:
                text = el.get_text(strip=True)
                if text and len(text) < 60:
                    return text
        if parent.name in ("body", "html"):
            break
    return "Unknown"


@router.get("/drakes-scan", response_model=list[DrakeStoreResult])
async def scan_drakes_stores(_admin: User = Depends(require_admin)):
    base = "https://online.drakes.com.au"
    async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
        try:
            resp = await client.get(base + "/", headers=_HEADERS)
            resp.raise_for_status()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not fetch Drakes store list: {e}")

        soup = BeautifulSoup(resp.text, "lxml")

        # "Shop Now" links on this page are internal paths like /abc123/i_choose_you
        # that redirect to https://{id}.drakes.com.au — collect them with store names.
        seen_hrefs: set[str] = set()
        candidates: list[dict] = []

        for a in soup.find_all("a", href=True):
            href = str(a.get("href", ""))
            text = a.get_text(strip=True).lower()
            if "shop" not in text:
                continue
            if href in seen_hrefs:
                continue
            # Must be an internal path (not already an external drakes URL)
            if href.startswith("http") and "drakes.com.au" not in href:
                continue
            if not href.startswith("/") and not href.startswith("http"):
                continue
            seen_hrefs.add(href)
            full_url = href if href.startswith("http") else base + href
            name = _find_store_name(a)
            name = re.sub(r"^Drakes\s+Online\s+", "", name, flags=re.I).strip()
            candidates.append({"href_url": full_url, "name": name or ""})

        async def resolve_store(candidate: dict) -> DrakeStoreResult | None:
            try:
                r = await client.get(candidate["href_url"], headers=_HEADERS, timeout=10)
                final_url = str(r.url)
                m = re.match(r"https?://(\d+)\.drakes\.com\.au", final_url)
                if not m:
                    return None
                store_id = m.group(1)
                working = r.status_code < 500
                name = candidate["name"] or f"Store {store_id}"
                return DrakeStoreResult(
                    id=store_id,
                    name=name,
                    url=f"https://{store_id}.drakes.com.au",
                    working=working,
                )
            except Exception:
                return None

        resolved = await asyncio.gather(*[resolve_store(c) for c in candidates])
        # Deduplicate by store ID, keeping first occurrence
        seen_ids: set[str] = set()
        results: list[DrakeStoreResult] = []
        for r in resolved:
            if r and r.id not in seen_ids:
                seen_ids.add(r.id)
                results.append(r)

    return sorted(results, key=lambda r: r.id)


class ColesStoreResult(BaseModel):
    id: str       # numeric only, e.g. "4497"
    name: str
    address: str


@router.get("/coles-search", response_model=list[ColesStoreResult])
async def search_coles_stores(postcode: str, _user: User = Depends(require_auth)):
    if not re.fullmatch(r"\d{4}", postcode):
        raise HTTPException(status_code=400, detail="postcode must be a 4-digit Australian postcode")

    from scrapers.coles import ColesScraper

    # Geocode postcode via Nominatim (OSM, free, no API key)
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as geo_client:
        try:
            geo = await geo_client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"postalcode": postcode, "country": "AU", "format": "json", "limit": "1"},
                headers={"User-Agent": "tightarse/1.0 (grocery price tracker)"},
            )
            results = geo.json()
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Geocoding failed: {e}")
    if not results:
        raise HTTPException(status_code=404, detail=f"Postcode {postcode} not found")
    lat = float(results[0]["lat"])
    lon = float(results[0]["lon"])

    # Query Coles GraphQL via the scraper client (has correct TLS/headers for Coles)
    scraper = ColesScraper()
    try:
        gql_query = (
            "{stores(latitude:%s,longitude:%s){results{store{id name address{oneLine}}}}}"
            % (lat, lon)
        )
        resp = await scraper.client.post(
            "https://www.coles.com.au/api/graphql",
            json={"query": gql_query},
            headers={
                "Ocp-Apim-Subscription-Key": "eae83861d1cd4de6bb9cd8a2cd6f041e",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Origin": "https://www.coles.com.au",
            },
        )
        data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Coles store lookup failed: {e}")
    finally:
        await scraper.close()

    raw = data.get("data", {}).get("stores", {}).get("results", [])
    stores = []
    for item in raw:
        store = item.get("store", {})
        sid = store.get("id", "")
        if not sid.startswith("COL:"):
            continue  # skip Liquorland, etc.
        stores.append(ColesStoreResult(
            id=sid.removeprefix("COL:"),
            name=store.get("name", ""),
            address=store.get("address", {}).get("oneLine", ""),
        ))
    return stores


class DrakeSavePayload(BaseModel):
    stores: list[DrakeStoreResult]


@router.post("/drakes-save", status_code=204)
def save_drakes_stores(
    payload: DrakeSavePayload,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    data = [{"id": s.id, "name": s.name} for s in payload.stores]
    row = db.query(Setting).filter(Setting.key == "drakes_store_map").first()
    if row:
        row.value = json.dumps(data)
    else:
        db.add(Setting(key="drakes_store_map", value=json.dumps(data)))
    db.commit()
