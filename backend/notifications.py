import logging
import smtplib
from email.mime.text import MIMEText

import httpx
from sqlalchemy.orm import Session

from database import Setting, get_user_setting

logger = logging.getLogger(__name__)


def _global(db: Session, key: str) -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else ""


def _user(db: Session, user_id: int, key: str) -> str:
    return get_user_setting(db, user_id, key) or ""


async def send_price_drop_notification(
    db: Session, channel: str, product, old_price: float, new_price: float,
    drop_pct: float, user_id: int,
):
    item_name = product.item.name
    store_name = product.store.name
    subject = f"Price drop: {item_name} at {store_name}"
    body = (
        f"{item_name}\n"
        f"Product: {product.name}\n"
        f"Store: {store_name}\n"
        f"Was: ${old_price:.2f}  Now: ${new_price:.2f}  (↓{drop_pct:.1f}%)\n"
        f"Link: {product.url}"
    )

    if channel == "email":
        await _send_email(db, user_id, subject, body)
    elif channel == "discord":
        await _send_discord(db, user_id, subject, body, product, old_price, new_price, drop_pct)
    elif channel == "gotify":
        await _send_gotify(db, user_id, subject, body)


async def _send_email(db: Session, user_id: int, subject: str, body: str):
    # SMTP infrastructure is global (admin-configured)
    host = _global(db, "email_smtp_host")
    port = int(_global(db, "email_smtp_port") or 587)
    smtp_user = _global(db, "email_smtp_user")
    password = _global(db, "email_smtp_password")
    from_addr = _global(db, "email_from") or smtp_user
    # Recipient is per-user
    to = _user(db, user_id, "email_to")

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to

    with smtplib.SMTP(host, port) as smtp:
        smtp.starttls()
        smtp.login(smtp_user, password)
        smtp.sendmail(smtp_user, [to], msg.as_string())


async def _send_discord(db: Session, user_id: int, subject: str, body: str, product, old_price: float, new_price: float, drop_pct: float):
    webhook_url = _user(db, user_id, "discord_webhook_url")
    embed = {
        "title": f"Price Drop: {product.item.name}",
        "description": (
            f"**{product.name}** @ {product.store.name}\n"
            f"~~${old_price:.2f}~~ → **${new_price:.2f}** (↓{drop_pct:.1f}%)"
        ),
        "url": product.url,
        "color": 0x2ECC71,
    }
    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json={"embeds": [embed]})


async def _send_gotify(db: Session, user_id: int, subject: str, body: str):
    server_url = _user(db, user_id, "gotify_server_url").rstrip("/")
    token = _user(db, user_id, "gotify_app_token")
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{server_url}/message",
            headers={"X-Gotify-Key": token},
            json={"title": subject, "message": body, "priority": 5},
        )
