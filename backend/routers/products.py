from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Product, Store, PriceHistory, Item
from scrapers import get_scraper
import scheduler as sched

router = APIRouter(prefix="/products", tags=["products"])


class ProductCreate(BaseModel):
    item_id: int
    store_id: int
    name: str
    url: str
    current_price: float | None = None


class ProductOut(BaseModel):
    id: int
    item_id: int
    store_id: int
    name: str
    url: str
    current_price: float | None
    last_scraped_at: datetime | None
    active: bool
    store_name: str | None = None

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


class SearchResult(BaseModel):
    name: str
    price: float | None
    url: str
    store_name: str


@router.get("/", response_model=list[ProductOut])
def list_products(item_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Product)
    if item_id is not None:
        q = q.filter(Product.item_id == item_id)
    products = q.all()
    return [_enrich(p) for p in products]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return _enrich(p)


@router.get("/{product_id}/history", response_model=list[PriceHistoryOut])
def get_price_history(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return (
        db.query(PriceHistory)
        .filter(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.recorded_at)
        .all()
    )


@router.post("/preview", response_model=ScrapePreviewResult)
async def preview_url(payload: dict, db: Session = Depends(get_db)):
    """Scrape a product URL and return details for user confirmation."""
    url = payload.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    store = _detect_store(url, db)
    if not store:
        raise HTTPException(status_code=400, detail="Unrecognised store URL")

    scraper = get_scraper(store.scraper_module)
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
    )


@router.post("/search", response_model=list[SearchResult])
async def search_store(payload: dict, db: Session = Depends(get_db)):
    """Search a store's own API and return candidates for the user to pick."""
    store_id = payload.get("store_id")
    query = payload.get("query", "").strip()
    if not store_id or not query:
        raise HTTPException(status_code=400, detail="store_id and query are required")

    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    scraper = get_scraper(store.scraper_module)
    try:
        results = await scraper.search(query)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Search failed: {e}")
    finally:
        await scraper.close()

    return results


@router.post("/", response_model=ProductOut, status_code=201)
async def create_product(payload: ProductCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not db.query(Item).filter(Item.id == payload.item_id).first():
        raise HTTPException(status_code=404, detail="Item not found")
    if not db.query(Store).filter(Store.id == payload.store_id).first():
        raise HTTPException(status_code=404, detail="Store not found")
    if db.query(Product).filter(Product.url == payload.url).first():
        raise HTTPException(status_code=409, detail="Product with this URL already exists")

    product = Product(
        item_id=payload.item_id,
        store_id=payload.store_id,
        name=payload.name,
        url=payload.url,
        current_price=payload.current_price,
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # Record initial price in history
    if payload.current_price is not None:
        db.add(PriceHistory(product_id=product.id, price=payload.current_price))
        db.commit()

    # Trigger an immediate scrape in the background to confirm and record the first data point
    background_tasks.add_task(sched.scrape_product, product.id)

    return _enrich(product)


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(p)
    db.commit()


@router.patch("/{product_id}/toggle", response_model=ProductOut)
def toggle_product(product_id: int, db: Session = Depends(get_db)):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    p.active = not p.active
    db.commit()
    db.refresh(p)
    return _enrich(p)


def _detect_store(url: str, db: Session) -> Store | None:
    stores = db.query(Store).all()
    for store in stores:
        if store.base_url in url:
            return store
    return None


def _enrich(p: Product) -> ProductOut:
    out = ProductOut.model_validate(p)
    out.store_name = p.store.name if p.store else None
    return out
