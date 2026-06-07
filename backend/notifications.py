import logging
import smtplib
from email.mime.text import MIMEText

import httpx
from sqlalchemy.orm import Session

from database import Setting

logger = logging.getLogger(__name__)


def _get(db: Session, key: str) -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else ""


async def send_price_drop_notification(db: Session, channel: str, product, old_price: float, new_price: float, drop_pct: float):
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
        await _send_email(db, subject, body)
    elif channel == "discord":
        await _send_discord(db, subject, body, product, old_price, new_price, drop_pct)
    elif channel == "gotify":
        await _send_gotify(db, subject, body)


async def _send_email(db: Session, subject: str, body: str):
    host = _get(db, "email_smtp_host")
    port = int(_get(db, "email_smtp_port") or 587)
    user = _get(db, "email_smtp_user")
    password = _get(db, "email_smtp_password")
    to = _get(db, "email_to")

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = user
    msg["To"] = to

    with smtplib.SMTP(host, port) as smtp:
        smtp.starttls()
        smtp.login(user, password)
        smtp.sendmail(user, [to], msg.as_string())


async def _send_discord(db: Session, subject: str, body: str, product, old_price: float, new_price: float, drop_pct: float):
    webhook_url = _get(db, "discord_webhook_url")
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


async def _send_gotify(db: Session, subject: str, body: str):
    server_url = _get(db, "gotify_server_url").rstrip("/")
    token = _get(db, "gotify_app_token")
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{server_url}/message",
            headers={"X-Gotify-Key": token},
            json={"title": subject, "message": body, "priority": 5},
        )
