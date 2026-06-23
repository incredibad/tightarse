import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from urllib.parse import urlparse
from database import get_db, SessionLocal, Product, Store, PriceHistory, Item, get_user_setting, get_global_setting
from auth import require_auth, require_admin, User
from scrapers import get_scraper
import scheduler as sched

async def _scrape_limited(product_id: int):
    # sched.scrape_product already acquires _SCRAPE_SEM (shared with scheduler)
    await sched.scrape_product(product_id)

router = APIRouter(prefix="/products", tags=["products"])


class ProductCreate(BaseModel):
    item_id: int
    store_id: int
    name: str
    url: str
    current_price: float | None = None
    cup_price: float | None = None
    cup_label: str | None = None
    package_size: str | None = None
    image_url: str | None = None


class ProductOut(BaseModel):
    id: int
    item_id: int
    store_id: int
    name: str
    url: str
    current_price: float | None
    was_price: float | None = None
    on_special: bool = False
    cup_price: float | None = None
    cup_label: str | None = None
    package_size: str | None = None
    last_scraped_at: datetime | None
    active: bool
    in_stock: bool = True
    store_name: str | None = None
    image_url: str | None = None

    class Config:
        from_attributes = True


class PriceHistoryOut(BaseModel):
    price: float
    recorded_at: datetime

    class Config:
        from_attributes = True


class ScrapePreviewResult(BaseModel):
    name: str
    price: float | None
    in_stock: bool
    store_name: str
    store_id: int
    url: str
    cup_price: float | None = None
    cup_label: str | None = None
    package_size: str | None = None
    image_url: str | None = None


class SearchResult(BaseModel):
    name: str
    price: float | None
    url: str
    store_name: str
    cup_price: float | None = None
    cup_label: str | None = None
    package_size: str | None = None
    image_url: str | None = None


def _own_product(db: Session, product_id: int, user_id: int) -> Product:
    p = db.query(Product).join(Item, Product.item_id == Item.id).filter(
        Product.id == product_id, Item.user_id == user_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


@router.get("/", response_model=list[ProductOut])
def list_products(
    item_id: int | None = None,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    q = db.query(Product).join(Item, Product.item_id == Item.id).filter(
        Item.user_id == current_user.id
    )
    if item_id is not None:
        q = q.filter(Product.item_id == item_id)
    return [_enrich(p) for p in q.all()]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    return _enrich(_own_product(db, product_id, current_user.id))


@router.get("/{product_id}/history", response_model=list[PriceHistoryOut])
def get_price_history(product_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    _own_product(db, product_id, current_user.id)
    return (
        db.query(PriceHistory)
        .filter(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.recorded_at)
        .all()
    )


@router.post("/preview", response_model=ScrapePreviewResult)
async def preview_url(payload: dict, _user: User = Depends(require_auth), db: Session = Depends(get_db)):
    url = payload.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    store = _detect_store(url, db)
    if not store:
        raise HTTPException(status_code=400, detail="Unrecognised store URL")

    try:
        scraper = get_scraper(store.scraper_module, **_scraper_kwargs(db, _user.id, store))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Close DB session before the (potentially slow) network call.
    db.close()

    try:
        result = await scraper.scrape_url(url)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Scrape failed: {e}")
    finally:
        await scraper.close()

    return ScrapePreviewResult(
        name=result.name,
        price=result.price,
        in_stock=result.in_stock,
        store_name=store.name,
        store_id=store.id,
        url=url,
        cup_price=result.cup_price,
        cup_label=result.cup_label,
        package_size=result.package_size,
        image_url=result.image_url,
    )


@router.post("/search", response_model=list[SearchResult])
async def search_store(payload: dict, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    store_id = payload.get("store_id")
    query = payload.get("query", "").strip()
    if not store_id or not query:
        raise HTTPException(status_code=400, detail="store_id and query are required")

    store = db.query(Store).filter(Store.id == store_id, Store.enabled != False).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found or disabled")

    try:
        scraper = get_scraper(store.scraper_module, **_scraper_kwargs(db, current_user.id, store))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    db.close()

    try:
        results = await scraper.search(query)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Search failed: {e}")
    finally:
        await scraper.close()

    return results


@router.post("/", response_model=ProductOut, status_code=201)
async def create_product(
    payload: ProductCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    item = db.query(Item).filter(Item.id == payload.item_id, Item.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if not db.query(Store).filter(Store.id == payload.store_id).first():
        raise HTTPException(status_code=404, detail="Store not found")
    if db.query(Product).join(Item, Product.item_id == Item.id).filter(
        Product.url == payload.url, Item.user_id == current_user.id
    ).first():
        raise HTTPException(status_code=409, detail="Product with this URL already exists")

    product = Product(
        item_id=payload.item_id,
        store_id=payload.store_id,
        name=payload.name,
        url=payload.url,
        current_price=payload.current_price,
        cup_price=payload.cup_price,
        cup_label=payload.cup_label,
        package_size=payload.package_size,
        image_url=payload.image_url,
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    if payload.current_price is not None:
        db.add(PriceHistory(product_id=product.id, price=payload.current_price))
        db.commit()

    background_tasks.add_task(sched.scrape_product, product.id)
    return _enrich(product)


@router.get("/scrape-stats")
async def scrape_stats(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    from sqlalchemy import func

    def _fmt(val):
        if val is None:
            return None
        # func.max/min on DateTime in SQLite returns a raw string, not datetime
        if isinstance(val, str):
            return val.replace(" ", "T") + "Z"
        return val.isoformat() + "Z"

    row = db.query(
        func.max(Product.last_scraped_at).label("last"),
        func.min(Product.last_scraped_at).label("oldest"),
        func.count(Product.id).label("total"),
    ).filter(Product.active == True).first()
    return {
        "last_scraped_at": _fmt(row.last),
        "oldest_scraped_at": _fmt(row.oldest),
        "total_active": row.total,
    }


@router.post("/rescrape/item/{item_id}", status_code=200)
async def rescrape_item(item_id: int, current_user: User = Depends(require_auth)):
    db = SessionLocal()
    try:
        item = db.query(Item).filter(Item.id == item_id, Item.user_id == current_user.id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        ids = [p.id for p in db.query(Product).filter(Product.item_id == item_id, Product.active == True).all()]
    finally:
        db.close()
    if ids:
        await asyncio.gather(*[_scrape_limited(pid) for pid in ids])
    return {"scraped": len(ids)}


@router.post("/rescrape/all", status_code=200)
async def rescrape_all(_admin: User = Depends(require_admin)):
    db = SessionLocal()
    try:
        ids = [p.id for p in db.query(Product).filter(Product.active == True).all()]
    finally:
        db.close()
    if ids:
        await asyncio.gather(*[_scrape_limited(pid) for pid in ids])
    return {"scraped": len(ids)}


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    p = _own_product(db, product_id, current_user.id)
    db.delete(p)
    db.commit()


@router.patch("/{product_id}/toggle", response_model=ProductOut)
def toggle_product(product_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    p = _own_product(db, product_id, current_user.id)
    p.active = not p.active
    db.commit()
    db.refresh(p)
    return _enrich(p)


def _detect_store(url: str, db: Session) -> Store | None:
    parsed = urlparse(url)
    stores = db.query(Store).all()
    for store in stores:
        store_host = urlparse(store.base_url).netloc
        if parsed.netloc == store_host or parsed.netloc.endswith("." + store_host):
            return store
    return None


def _enrich(p: Product) -> ProductOut:
    out = ProductOut.model_validate(p)
    out.store_name = p.store.name if p.store else None
    return out


def _resolve_proxy(db: Session, scraper_module: str) -> str:
    proxy_url = get_global_setting(db, "vpn_proxy_url")
    via_vpn = get_global_setting(db, "scrape_via_vpn") == "true"
    if scraper_module == "amazon" or via_vpn:
        return proxy_url
    return ""


def _scraper_kwargs(db: Session, user_id: int, store: Store) -> dict:
    kwargs: dict = {"proxy_url": _resolve_proxy(db, store.scraper_module)}
    if store.scraper_module == "drakes":
        kwargs["store_id"] = get_user_setting(db, user_id, "drakes_store_id") or "087"
    return kwargs
