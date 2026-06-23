import json
import re

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import require_auth, User
from database import get_db, Item, Product, get_user_setting, get_global_setting


def _comparable_price(product) -> float:
    """Normalize cup price to per-gram or per-ml for fair comparison; fall back to shelf price
    for non-weight/volume units (per ea, per sheet, etc.) or when no cup price is available."""
    if product.cup_price is not None and product.cup_label:
        label = product.cup_label.lower().replace(" ", "")
        wm = re.search(r"per(\d*\.?\d*)(kg|g)\b", label)
        if wm:
            qty = float(wm.group(1)) if wm.group(1) else 1.0
            grams = qty * 1000 if wm.group(2) == "kg" else (qty or 1.0)
            return product.cup_price / grams
        vm = re.search(r"per(\d*\.?\d*)(litre|liter|l|ml)\b", label)
        if vm:
            qty = float(vm.group(1)) if vm.group(1) else 1.0
            ml = qty * 1000 if (vm.group(2) != "ml" and vm.group(2).startswith("l")) else (qty or 1.0)
            return product.cup_price / ml
    return product.current_price  # fallback: shelf price

router = APIRouter(prefix="/journey", tags=["journey"])


class JourneyProduct(BaseModel):
    product_id: int
    product_name: str
    store_name: str
    price: float
    was_price: float | None = None
    on_special: bool = False
    cup_price: float | None = None
    cup_label: str | None = None
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


@router.get("/", response_model=JourneyResult)
def get_journey(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    """Calculate the cheapest basket by grouping cheapest products per item by store."""
    items = db.query(Item).filter(Item.user_id == current_user.id).all()
    store_priority = _user_store_priority(db, current_user.id)
    vpn_proxy_url = get_global_setting(db, "vpn_proxy_url")

    all_journey_items: list[JourneyItem] = []
    estimated_total = 0.0

    for item in items:
        active_products = [
            p for p in item.products
            if p.active
            and p.in_stock is not False
            and p.current_price is not None
            and _store_enabled_for_user(db, current_user.id, p.store_id)
            and _store_available(p.store, vpn_proxy_url)
        ]
        if not active_products:
            continue

        priced = sorted(active_products, key=lambda p: (_comparable_price(p), store_priority.get(p.store_id, p.store.priority if p.store.priority is not None else 999)))
        cheapest = priced[0]
        estimated_total += cheapest.current_price

        journey_products = [
            JourneyProduct(
                product_id=p.id,
                product_name=p.name,
                store_name=p.store.name,
                price=p.current_price,
                was_price=p.was_price,
                on_special=bool(p.on_special),
                cup_price=p.cup_price,
                cup_label=p.cup_label,
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
        for sg in sorted(
            store_map.values(),
            key=lambda s: store_priority.get(s["store_id"], 999),
        )
    ]

    return JourneyResult(
        stores=stores,
        estimated_total=round(estimated_total, 2),
    )


def _store_available(store, vpn_proxy_url: str) -> bool:
    if store and store.scraper_module == "amazon":
        return bool(vpn_proxy_url)
    return True


def _store_enabled_for_user(db, user_id: int, store_id: int) -> bool:
    val = get_user_setting(db, user_id, f"store_{store_id}_enabled")
    if val is None:
        return True
    return val.lower() not in ("false", "0", "no")


def _user_store_priority(db, user_id: int) -> dict[int, int]:
    """Returns {store_id: priority_index} from the user's saved store_order preference."""
    val = get_user_setting(db, user_id, "store_order")
    if val:
        try:
            order = json.loads(val)
            return {int(sid): i for i, sid in enumerate(order)}
        except Exception:
            pass
    return {}
