import asyncio
import logging
from datetime import datetime, date

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from database import SessionLocal, Product, Store, PriceHistory, Notification, Setting, get_user_setting, get_global_setting, record_vpn_ip, record_scrape_run
from scrapers import get_scraper
from notifications import send_price_drop_notification

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

_SCRAPE_SEM = asyncio.Semaphore(6)  # max concurrent URL scrapes across scheduler + manual triggers


async def scrape_product(product_id: int) -> bool:
    async with _SCRAPE_SEM:
        return await _scrape_product_inner(product_id)


async def _scrape_product_inner(product_id: int) -> bool:
    db: Session = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id, Product.active == True).first()
        if not product or not product.store or not product.store.enabled:
            return False
        url = product.url
        scraper_module = product.store.scraper_module
        proxy = _resolve_proxy(db, scraper_module)
    finally:
        db.close()

    if proxy:
        logger.info(f"Scraping {url} via proxy {proxy}")
    try:
        scraper = get_scraper(scraper_module, proxy_url=proxy)
    except ValueError as e:
        logger.warning(f"Cannot scrape product {product_id}: {e}")
        return False
    try:
        result = await scraper.scrape_url(url)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            logger.error(f"Product {product_id} returned 404 — marking out of stock")
            db = SessionLocal()
            try:
                product = db.query(Product).filter(Product.id == product_id).first()
                if product:
                    product.in_stock = False
                    product.last_scraped_at = datetime.utcnow()
                    db.commit()
            finally:
                db.close()
        else:
            logger.error(f"Scrape failed for product {product_id}: {e}")
        return False
    except Exception as e:
        logger.error(f"Scrape failed for product {product_id}: {e}")
        return False
    finally:
        await scraper.close()

    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if product:
            await _apply_scrape_result(db, product, result, datetime.utcnow())
            db.commit()
            return True
        return False
    except Exception as e:
        logger.error(f"Error processing product {product_id}: {e}")
        db.rollback()
        return False
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


async def _scrape_url_group(url: str, product_ids: list[int]) -> tuple[int, int]:
    """Scrape one URL and write results for all product rows sharing that URL.
    Returns (success_count, failed_count)."""
    async with _SCRAPE_SEM:
        db: Session = SessionLocal()
        try:
            products = db.query(Product).filter(Product.id.in_(product_ids), Product.active == True).all()
            if not products:
                return 0, len(product_ids)
            scraper_module = products[0].store.scraper_module
            proxy = _resolve_proxy(db, scraper_module)
        finally:
            db.close()

        if proxy:
            logger.info(f"Scraping {url} via proxy {proxy}")
        try:
            scraper = get_scraper(scraper_module, proxy_url=proxy)
        except ValueError as e:
            logger.warning(f"Cannot scrape {url}: {e}")
            return 0, len(product_ids)
        try:
            result = await scraper.scrape_url(url)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.error(f"{url} returned 404 — marking {len(product_ids)} product(s) out of stock")
                db = SessionLocal()
                try:
                    now = datetime.utcnow()
                    for pid in product_ids:
                        p = db.query(Product).filter(Product.id == pid).first()
                        if p:
                            p.in_stock = False
                            p.last_scraped_at = now
                    db.commit()
                finally:
                    db.close()
            else:
                logger.error(f"Scrape failed for {url}: {e}")
            return 0, len(product_ids)
        except Exception as e:
            logger.error(f"Scrape failed for {url}: {e}")
            return 0, len(product_ids)
        finally:
            await scraper.close()

        db = SessionLocal()
        try:
            products = db.query(Product).filter(Product.id.in_(product_ids), Product.active == True).all()
            now = datetime.utcnow()
            for product in products:
                await _apply_scrape_result(db, product, result, now)
            db.commit()
            return len(products), 0
        except Exception as e:
            logger.error(f"Error processing {url}: {e}")
            db.rollback()
            return 0, len(product_ids)
        finally:
            db.close()


async def _check_and_record_vpn_ip(proxy_url: str):
    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=10.0) as client:
            r = await client.get("https://ipinfo.io/json")
            r.raise_for_status()
            data = r.json()
        ip = data.get("ip", "unknown")
        db = SessionLocal()
        try:
            inserted = record_vpn_ip(db, ip, data.get("org"), data.get("city"), data.get("country"))
            if inserted:
                logger.info(f"VPN exit IP changed → {ip} ({data.get('org', '')} {data.get('city', '')})")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"VPN IP check failed: {e}")


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
        proxy_url = get_global_setting(db, "vpn_proxy_url")
        via_vpn = get_global_setting(db, "scrape_via_vpn") == "true"
    finally:
        db.close()

    unique = len(url_to_ids)
    total = sum(len(v) for v in url_to_ids.values())
    logger.info(f"Scheduled scrape: {unique} unique URLs covering {total} product rows")

    if proxy_url and via_vpn:
        await _check_and_record_vpn_ip(proxy_url)

    started_at = datetime.utcnow()
    results = await asyncio.gather(*[_scrape_url_group(url, ids) for url, ids in url_to_ids.items()])
    success = sum(r[0] for r in results)
    failed = sum(r[1] for r in results)
    logger.info(f"Scheduled scrape complete: {success} succeeded, {failed} failed")
    db = SessionLocal()
    try:
        record_scrape_run(db, started_at, success, failed)
    finally:
        db.close()


def _resolve_proxy(db: Session, scraper_module: str) -> str:
    proxy_url = get_global_setting(db, "vpn_proxy_url")
    via_vpn = get_global_setting(db, "scrape_via_vpn") == "true"
    if scraper_module == "amazon" or via_vpn:
        return proxy_url
    return ""


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


def _build_trigger(schedule_type: str, schedule_time: str, schedule_day: str):
    try:
        hour, minute = map(int, schedule_time.split(":"))
    except Exception:
        hour, minute = 6, 0

    if schedule_type == "12h":
        return IntervalTrigger(hours=12)
    if schedule_type == "daily":
        return CronTrigger(hour=hour, minute=minute)
    if schedule_type == "2d":
        today = date.today()
        from datetime import datetime as dt
        start = dt(today.year, today.month, today.day, hour, minute)
        return IntervalTrigger(days=2, start_date=start)
    if schedule_type == "weekly":
        return CronTrigger(day_of_week=schedule_day, hour=hour, minute=minute)
    # default: 6h
    return IntervalTrigger(hours=6)


def reschedule(schedule_type: str = "6h", schedule_time: str = "06:00", schedule_day: str = "mon"):
    trigger = _build_trigger(schedule_type, schedule_time, schedule_day)
    scheduler.add_job(
        scrape_all_active_products,
        trigger=trigger,
        id="scrape_all",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    logger.info(f"Scraper rescheduled: type={schedule_type} time={schedule_time} day={schedule_day}")


def start_scheduler(schedule_type: str = "6h", schedule_time: str = "06:00", schedule_day: str = "mon"):
    reschedule(schedule_type, schedule_time, schedule_day)
    if not scheduler.running:
        scheduler.start()
