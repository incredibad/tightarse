import asyncio
import smtplib
from email.mime.text import MIMEText

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, SessionLocal, Setting, UserSetting, Product, VpnCheckHistory, GLOBAL_SETTING_KEYS, USER_SETTING_DEFAULTS, get_global_setting, record_vpn_ip
from auth import require_auth, require_admin, User
import scheduler as sched

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingOut(BaseModel):
    key: str
    value: str | None


class SettingsBulkUpdate(BaseModel):
    settings: dict[str, str]


@router.get("/", response_model=list[SettingOut])
def list_settings(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    results: list[SettingOut] = []

    # Global settings — admins see SMTP config too; users only see non-sensitive global keys
    smtp_keys = {"email_smtp_host", "email_smtp_port", "email_smtp_user", "email_smtp_password"}
    global_rows = db.query(Setting).order_by(Setting.key).all()
    for row in global_rows:
        if row.key == "jwt_secret":
            continue
        if row.key in smtp_keys and current_user.role != "admin":
            continue
        results.append(SettingOut(key=row.key, value=row.value))

    # Per-user settings — all rows from UserSetting, with defaults filled in for missing keys
    user_rows = {r.key: r.value for r in db.query(UserSetting).filter(UserSetting.user_id == current_user.id).all()}
    seen = set()
    for key, default in USER_SETTING_DEFAULTS.items():
        results.append(SettingOut(key=key, value=user_rows.get(key, default)))
        seen.add(key)
    # Also return any dynamic per-user keys (store_order, store_{id}_enabled, etc.)
    # Skip keys that are global settings — stale UserSetting rows must not shadow them.
    for key, value in user_rows.items():
        if key not in seen and key not in GLOBAL_SETTING_KEYS:
            results.append(SettingOut(key=key, value=value))

    return results


@router.put("/", response_model=list[SettingOut])
def update_settings(
    payload: SettingsBulkUpdate,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    updated: list[SettingOut] = []

    for key, value in payload.settings.items():
        if key == "jwt_secret":
            raise HTTPException(status_code=400, detail="Cannot modify jwt_secret")

        if key in GLOBAL_SETTING_KEYS:
            if current_user.role != "admin":
                raise HTTPException(status_code=403, detail=f"Setting '{key}' is admin-only")
            row = db.query(Setting).filter(Setting.key == key).first()
            if row:
                row.value = value
            else:
                row = Setting(key=key, value=value)
                db.add(row)
            updated.append(SettingOut(key=key, value=value))
        else:
            # Per-user setting
            row = db.query(UserSetting).filter(
                UserSetting.user_id == current_user.id, UserSetting.key == key
            ).first()
            if row:
                row.value = value
            else:
                row = UserSetting(user_id=current_user.id, key=key, value=value)
                db.add(row)
            updated.append(SettingOut(key=key, value=value))

    db.commit()

    schedule_keys = {"scrape_schedule_type", "scrape_schedule_time", "scrape_schedule_day"}
    if schedule_keys & set(payload.settings.keys()):
        def _gs(key, default=""):
            row = db.query(Setting).filter(Setting.key == key).first()
            return row.value if row and row.value else default
        sched.reschedule(
            _gs("scrape_schedule_type", "6h"),
            _gs("scrape_schedule_time", "06:00"),
            _gs("scrape_schedule_day", "mon"),
        )

    return updated


class TestEmailPayload(BaseModel):
    to: str


@router.post("/test-email", status_code=204)
async def test_email(
    payload: TestEmailPayload,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    def g(key):
        row = db.query(Setting).filter(Setting.key == key).first()
        return row.value if row else ""

    host = g("email_smtp_host")
    port = int(g("email_smtp_port") or 587)
    smtp_user = g("email_smtp_user")
    password = g("email_smtp_password")
    from_addr = g("email_from") or smtp_user

    if not host or not smtp_user:
        raise HTTPException(status_code=400, detail="SMTP host and username are required")

    # Grab up to 3 priced active products to use as realistic examples
    products = (
        db.query(Product)
        .filter(Product.active == True, Product.current_price != None)
        .limit(3)
        .all()
    )

    if products:
        lines = []
        for p in products:
            old = round(p.current_price * 1.12, 2)  # simulate ~12% drop
            now = p.current_price
            drop = (old - now) / old * 100
            item_name = p.item.name if p.item else p.name
            lines.append(
                f"{item_name}\n"
                f"Product: {p.name}\n"
                f"Store: {p.store.name}\n"
                f"Was: ${old:.2f}  Now: ${now:.2f}  (↓{drop:.1f}%)\n"
                f"Link: {p.url}"
            )
        subject = f"Price drops: {', '.join(p.item.name if p.item else p.name for p in products)}"
        body = "\n\n---\n\n".join(lines)
    else:
        subject = "Tightarse — test email"
        body = (
            "Oat Milk (1L)\n"
            "Product: Macro Organic Oat Milk 1L\n"
            "Store: Woolworths\n"
            "Was: $3.50  Now: $2.80  (↓20.0%)\n"
            "Link: https://www.woolworths.com.au/shop/productdetails/123456"
        )

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = payload.to

    def _send():
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(smtp_user, password)
            smtp.sendmail(smtp_user, [payload.to], msg.as_string())

    try:
        await asyncio.get_event_loop().run_in_executor(None, _send)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"SMTP error: {e}")


@router.post("/test-proxy")
async def test_proxy(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    proxy_url = get_global_setting(db, "vpn_proxy_url")
    db.close()
    if not proxy_url:
        raise HTTPException(status_code=400, detail="No proxy URL configured")
    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=10.0) as client:
            r = await client.get("https://ipinfo.io/json")
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Proxy test failed: {e}")

    ip = data.get("ip", "unknown")
    org = data.get("org")
    city = data.get("city")
    country = data.get("country")

    db2 = SessionLocal()
    try:
        record_vpn_ip(db2, ip, org, city, country)
    finally:
        db2.close()

    return {"ip": ip, "org": org, "city": city, "country": country}


@router.get("/proxy-history")
async def proxy_history(_admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = (
        db.query(VpnCheckHistory)
        .order_by(VpnCheckHistory.checked_at.desc())
        .limit(50)
        .all()
    )
    return [
        {"id": r.id, "ip": r.ip, "org": r.org, "city": r.city, "country": r.country,
         "checked_at": r.checked_at.isoformat() + "Z"}
        for r in rows
    ]
