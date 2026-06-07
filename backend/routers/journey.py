from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Item, Product

router = APIRouter(prefix="/journey", tags=["journey"])


class JourneyProduct(BaseModel):
    product_id: int
    product_name: str
    price: float
    url: str
    is_cheapest: bool
    alternatives_count: int


class JourneyItem(BaseModel):
    item_id: int
    item_name: str
    category: str | None
    cheapest_product: JourneyProduct
    all_products: list[JourneyProduct]


class StoreGroup(BaseModel):
    store_id: int
    store_name: str
    subtotal: float
    items: list[JourneyItem]


class JourneyResult(BaseModel):
    stores: list[StoreGroup]
    estimated_total: float
    potential_saving: float


@router.get("/", response_model=JourneyResult)
def get_journey(db: Session = Depends(get_db)):
    """Calculate the cheapest basket by grouping cheapest products per item by store."""
    items = db.query(Item).all()

    all_journey_items: list[JourneyItem] = []
    estimated_total = 0.0
    max_possible = 0.0

    for item in items:
        active_products = [p for p in item.products if p.active and p.current_price is not None]
        if not active_products:
            continue

        priced = sorted(active_products, key=lambda p: p.current_price)
        cheapest = priced[0]
        most_expensive = priced[-1]

        estimated_total += cheapest.current_price
        max_possible += most_expensive.current_price

        journey_products = [
            JourneyProduct(
                product_id=p.id,
                product_name=p.name,
                price=p.current_price,
                url=p.url,
                is_cheapest=(p.id == cheapest.id),
                alternatives_count=len(active_products) - 1,
            )
            for p in priced
        ]

        all_journey_items.append(JourneyItem(
            item_id=item.id,
            item_name=item.name,
            category=item.category,
            cheapest_product=journey_products[0],
            all_products=journey_products,
        ))

    # Group cheapest selections by store
    store_map: dict[int, dict] = {}
    for ji in all_journey_items:
        cp = ji.cheapest_product
        product = db.query(Product).filter(Product.id == cp.product_id).first()
        if not product:
            continue
        store = product.store
        if store.id not in store_map:
            store_map[store.id] = {"store_id": store.id, "store_name": store.name, "subtotal": 0.0, "items": []}
        store_map[store.id]["subtotal"] += cp.price
        store_map[store.id]["items"].append(ji)

    stores = [
        StoreGroup(**sg)
        for sg in sorted(store_map.values(), key=lambda s: s["subtotal"], reverse=True)
    ]

    return JourneyResult(
        stores=stores,
        estimated_total=round(estimated_total, 2),
        potential_saving=round(max_possible - estimated_total, 2),
    )
