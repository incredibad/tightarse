import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from database import SessionLocal, Product, Store, PriceHistory, Notification, Setting, get_user_setting
from scrapers import get_scraper
from notifications import send_price_drop_notification

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def scrape_product(product_id: int):
    db: Session = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id, Product.active == True).first()
        if not product or not product.store or not product.store.enabled:
            return

        scraper = get_scraper(product.store.scraper_module)
        try:
            result = await scraper.scrape_url(product.url)
        except Exception as e:
            logger.warning(f"Scrape failed for product {product_id}: {e}")
            return
        finally:
            await scraper.close()

        now = datetime.utcnow()
        await _apply_scrape_result(db, product, result, now)
        db.commit()

    except Exception as e:
        logger.error(f"Error processing product {product_id}: {e}")
        db.rollback()
    finally:
        db.close()


async def _apply_scrape_result(db: Session, product: Product, result, now: datetime):
    product.in_stock = result.in_stock
    if result.in_stock:
        old_price = product.current_price
        new_price = result.price
        if new_price is not None:
            if old_price is None or abs(new_price - old_price) > 0.001:
                db.add(PriceHistory(product_id=product.id, price=new_price, recorded_at=now))
                if old_price is not None and new_price < old_price:
                    await _maybe_notify_price_drop(db, product, old_price, new_price)
                product.current_price = new_price
        product.on_special = result.on_special
        product.was_price = result.was_price
    product.cup_price = result.cup_price
    product.cup_label = result.cup_label
    product.package_size = result.package_size
    product.last_scraped_at = now
    product.name = result.name
    if result.image_url:
        product.image_url = result.image_url


async def scrape_all_active_products():
    db: Session = SessionLocal()
    try:
        rows = (
            db.query(Product.url, Product.id)
            .join(Store, Product.store_id == Store.id)
            .filter(Product.active == True, Store.enabled == True)
            .all()
        )
        url_to_ids: dict[str, list[int]] = {}
        for url, pid in rows:
            url_to_ids.setdefault(url, []).append(pid)
    finally:
        db.close()

    unique = len(url_to_ids)
    total = sum(len(v) for v in url_to_ids.values())
    logger.info(f"Scheduled scrape: {unique} unique URLs covering {total} product rows")

    for url, product_ids in url_to_ids.items():
        db: Session = SessionLocal()
        try:
            products = db.query(Product).filter(Product.id.in_(product_ids), Product.active == True).all()
            if not products:
                continue
            scraper = get_scraper(products[0].store.scraper_module)
            try:
                result = await scraper.scrape_url(url)
            except Exception as e:
                logger.warning(f"Scrape failed for {url}: {e}")
                continue
            finally:
                await scraper.close()
            now = datetime.utcnow()
            for product in products:
                await _apply_scrape_result(db, product, result, now)
            db.commit()
        except Exception as e:
            logger.error(f"Error processing {url}: {e}")
            db.rollback()
        finally:
            db.close()


async def _maybe_notify_price_drop(db: Session, product, old_price: float, new_price: float):
    # Notifications are per-user — look up the item owner
    user_id = product.item.user_id if product.item else None
    if not user_id:
        return

    threshold_val = get_user_setting(db, user_id, "notify_price_drop_threshold_pct")
    threshold = float(threshold_val) if threshold_val else 5.0
    drop_pct = (old_price - new_price) / old_price * 100

    if drop_pct < threshold:
        return

    for channel in ["email", "discord", "gotify"]:
        enabled_val = get_user_setting(db, user_id, f"{channel}_enabled")
        if enabled_val == "true":
            try:
                await send_price_drop_notification(
                    db=db,
                    channel=channel,
                    product=product,
                    old_price=old_price,
                    new_price=new_price,
                    drop_pct=drop_pct,
                    user_id=user_id,
                )
                db.add(Notification(
                    product_id=product.id,
                    type="price_drop",
                    sent_at=datetime.utcnow(),
                    channel=channel,
                ))
            except Exception as e:
                logger.error(f"Notification failed [{channel}] for product {product.id}: {e}")


def reschedule(interval_hours: float):
    if scheduler.get_job("scrape_all"):
        scheduler.remove_job("scrape_all")
    scheduler.add_job(
        scrape_all_active_products,
        trigger=IntervalTrigger(hours=interval_hours),
        id="scrape_all",
        replace_existing=True,
    )
    logger.info(f"Scraper rescheduled: every {interval_hours}h")


def start_scheduler(interval_hours: float = 6.0):
    reschedule(interval_hours)
    if not scheduler.running:
        scheduler.start()
