import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from database import SessionLocal, Product, PriceHistory, Notification, Setting
from scrapers import get_scraper
from notifications import send_price_drop_notification

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def scrape_product(product_id: int):
    db: Session = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id, Product.active == True).first()
        if not product:
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
        old_price = product.current_price
        new_price = result.price

        if new_price is not None:
            if old_price is None or abs(new_price - old_price) > 0.001:
                db.add(PriceHistory(product_id=product_id, price=new_price, recorded_at=now))

                if old_price is not None and new_price < old_price:
                    await _maybe_notify_price_drop(db, product, old_price, new_price)

                product.current_price = new_price

        product.last_scraped_at = now
        product.name = result.name  # keep name fresh from store
        db.commit()

    except Exception as e:
        logger.error(f"Error processing product {product_id}: {e}")
        db.rollback()
    finally:
        db.close()


async def scrape_all_active_products():
    db: Session = SessionLocal()
    try:
        product_ids = [r[0] for r in db.query(Product.id).filter(Product.active == True).all()]
    finally:
        db.close()

    logger.info(f"Scheduled scrape: {len(product_ids)} active products")
    for pid in product_ids:
        await scrape_product(pid)


async def _maybe_notify_price_drop(db: Session, product, old_price: float, new_price: float):
    threshold_setting = db.query(Setting).filter(Setting.key == "notify_price_drop_threshold_pct").first()
    threshold = float(threshold_setting.value) if threshold_setting else 5.0
    drop_pct = (old_price - new_price) / old_price * 100

    if drop_pct < threshold:
        return

    for channel in ["email", "discord", "gotify"]:
        enabled_setting = db.query(Setting).filter(Setting.key == f"{channel}_enabled").first()
        if enabled_setting and enabled_setting.value == "true":
            try:
                await send_price_drop_notification(
                    db=db,
                    channel=channel,
                    product=product,
                    old_price=old_price,
                    new_price=new_price,
                    drop_pct=drop_pct,
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
