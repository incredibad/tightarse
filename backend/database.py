from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text, UniqueConstraint, event, text
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

DATABASE_URL = "sqlite:////data/tightarse.db"

# NullPool: SQLite is file-based — connection pooling adds no benefit and
# causes pool exhaustion when many concurrent async tasks each hold a session.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=NullPool,
)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="item", cascade="all, delete-orphan")


class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    base_url = Column(String, nullable=False)
    scraper_module = Column(String, nullable=False)
    enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # lower = checked first in Journey ties

    products = relationship("Product", back_populates="store")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    current_price = Column(Float, nullable=True)
    was_price = Column(Float, nullable=True)
    on_special = Column(Boolean, default=False)
    cup_price = Column(Float, nullable=True)
    cup_label = Column(String, nullable=True)
    package_size = Column(String, nullable=True)
    last_scraped_at = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)
    in_stock = Column(Boolean, default=True, nullable=False)
    image_url = Column(String, nullable=True)

    item = relationship("Item", back_populates="products")
    store = relationship("Store", back_populates="products")
    price_history = relationship("PriceHistory", back_populates="product", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="product", cascade="all, delete-orphan")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    price = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="price_history")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    type = Column(String, nullable=False)  # price_drop, back_in_stock
    sent_at = Column(DateTime, nullable=True)
    channel = Column(String, nullable=False)  # email, discord, gotify

    product = relationship("Product", back_populates="notifications")


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, nullable=False, unique=True)
    value = Column(Text, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, unique=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user")  # "admin" | "user"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    settings = relationship("UserSetting", back_populates="user", cascade="all, delete-orphan")
    checklist_items = relationship("ChecklistItem", back_populates="user", cascade="all, delete-orphan")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    checked = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="checklist_items")


class UserSetting(Base):
    __tablename__ = "user_settings"
    __table_args__ = (UniqueConstraint("user_id", "key"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    key = Column(String, nullable=False)
    value = Column(Text, nullable=True)

    user = relationship("User", back_populates="settings")


class VpnCheckHistory(Base):
    __tablename__ = "vpn_check_history"

    id = Column(Integer, primary_key=True, index=True)
    ip = Column(String, nullable=False)
    org = Column(String)
    city = Column(String)
    country = Column(String)
    checked_at = Column(DateTime, default=datetime.utcnow)


class ScrapeRunHistory(Base):
    __tablename__ = "scrape_run_history"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    success = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)


def record_scrape_run(db, started_at, success: int, failed: int):
    db.add(ScrapeRunHistory(started_at=started_at, success=success, failed=failed))
    db.commit()


def record_vpn_ip(db, ip: str, org=None, city=None, country=None) -> bool:
    """Insert a VPN check only when the exit IP differs from the most recent entry. Returns True if inserted."""
    last = db.query(VpnCheckHistory).order_by(VpnCheckHistory.checked_at.desc()).first()
    if last and last.ip == ip:
        return False
    db.add(VpnCheckHistory(ip=ip, org=org, city=city, country=country, checked_at=datetime.utcnow()))
    db.commit()
    oldest_ids = [
        row.id for row in db.query(VpnCheckHistory.id)
        .order_by(VpnCheckHistory.checked_at.desc())
        .offset(200).all()
    ]
    if oldest_ids:
        db.query(VpnCheckHistory).filter(VpnCheckHistory.id.in_(oldest_ids)).delete(synchronize_session=False)
        db.commit()
    return True


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate_db()
    _seed_stores()
    _seed_default_settings()


def _migrate_db():
    """Add columns that may be missing from databases created before they were introduced."""
    migrations = [
        "ALTER TABLE products ADD COLUMN was_price FLOAT",
        "ALTER TABLE products ADD COLUMN on_special BOOLEAN DEFAULT 0 NOT NULL",
        "ALTER TABLE products ADD COLUMN cup_price FLOAT",
        "ALTER TABLE products ADD COLUMN cup_label VARCHAR",
        "ALTER TABLE products ADD COLUMN package_size VARCHAR",
        "ALTER TABLE products ADD COLUMN image_url VARCHAR",
        "ALTER TABLE stores ADD COLUMN enabled BOOLEAN DEFAULT 1",
        "DELETE FROM stores WHERE scraper_module = 'iga'",
        # multi-user migrations
        "ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user'",
        "ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1",
        "ALTER TABLE items ADD COLUMN user_id INTEGER REFERENCES users(id)",
        # store priority
        "ALTER TABLE stores ADD COLUMN priority INTEGER DEFAULT 0",
        # set initial priorities by id order so existing installs have a stable starting order
        "UPDATE stores SET priority = id WHERE priority = 0 OR priority IS NULL",
        # promote first user to admin
        "UPDATE users SET role='admin' WHERE id=(SELECT MIN(id) FROM users)",
        # assign orphaned items to first user
        "UPDATE items SET user_id=(SELECT MIN(id) FROM users) WHERE user_id IS NULL",
        "ALTER TABLE products ADD COLUMN in_stock BOOLEAN DEFAULT 1 NOT NULL",
        # drop unique index on products.url (created by unique=True before multi-user support)
        "DROP INDEX IF EXISTS uq_products_url",
        "DROP INDEX IF EXISTS ix_products_url",
        # clean up leftover tables from previous migration attempts
        "DROP TABLE IF EXISTS products_new",
        "CREATE TABLE IF NOT EXISTS checklist_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, checked INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0, created_at TEXT)",
        "CREATE TABLE IF NOT EXISTS vpn_check_history (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT NOT NULL, org TEXT, city TEXT, country TEXT, checked_at TEXT)",
        "CREATE TABLE IF NOT EXISTS scrape_run_history (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, success INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0)",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # column/change already applied
        _fix_renamed_table_fks(conn)

    _migrate_settings_to_user()


def _fix_renamed_table_fks(conn):
    """Fix FK references that SQLite auto-updated when products was renamed to products_old.

    SQLite rewrites FK references in child tables when the parent is renamed, so
    price_history and notifications ended up referencing products_old instead of products.
    We need to recreate those tables pointing to products, then drop products_old.
    """
    row = conn.execute(text("SELECT sql FROM sqlite_master WHERE name='price_history'")).fetchone()
    if not row or "products_old" not in (row[0] or ""):
        # Already fixed or fresh install — just drop the leftover table if it exists
        conn.execute(text("PRAGMA foreign_keys=OFF"))
        conn.execute(text("DROP TABLE IF EXISTS products_old"))
        conn.execute(text("PRAGMA foreign_keys=ON"))
        conn.commit()
        return

    conn.execute(text("PRAGMA foreign_keys=OFF"))
    conn.commit()

    conn.execute(text("""CREATE TABLE price_history_new (
        id INTEGER NOT NULL, product_id INTEGER NOT NULL, price FLOAT NOT NULL,
        recorded_at DATETIME, PRIMARY KEY (id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )"""))
    conn.execute(text("INSERT INTO price_history_new SELECT * FROM price_history"))
    conn.execute(text("DROP TABLE price_history"))
    conn.execute(text("ALTER TABLE price_history_new RENAME TO price_history"))
    conn.commit()

    conn.execute(text("""CREATE TABLE notifications_new (
        id INTEGER NOT NULL, product_id INTEGER NOT NULL, type VARCHAR NOT NULL,
        sent_at DATETIME, channel VARCHAR NOT NULL, PRIMARY KEY (id),
        FOREIGN KEY(product_id) REFERENCES products(id)
    )"""))
    conn.execute(text("INSERT INTO notifications_new SELECT * FROM notifications"))
    conn.execute(text("DROP TABLE notifications"))
    conn.execute(text("ALTER TABLE notifications_new RENAME TO notifications"))
    conn.commit()

    conn.execute(text("DROP TABLE IF EXISTS products_old"))
    conn.execute(text("PRAGMA foreign_keys=ON"))
    conn.commit()


def _seed_stores():
    db = SessionLocal()
    try:
        stores = [
            Store(name="Woolworths", base_url="https://www.woolworths.com.au", scraper_module="woolworths"),
            Store(name="Coles", base_url="https://www.coles.com.au", scraper_module="coles"),
            Store(name="ALDI", base_url="https://www.aldi.com.au", scraper_module="aldi"),
            Store(name="Drakes", base_url="https://drakes.com.au", scraper_module="drakes"),
            Store(name="Amazon Australia", base_url="https://www.amazon.com.au", scraper_module="amazon"),
        ]
        for store in stores:
            existing = db.query(Store).filter(Store.name == store.name).first()
            if not existing:
                db.add(store)
        db.commit()
    finally:
        db.close()


def _seed_default_settings():
    db = SessionLocal()
    # Only global/admin settings live in the Setting table
    global_defaults = {
        "scrape_schedule_type": "6h",
        "scrape_schedule_time": "06:00",
        "scrape_schedule_day": "mon",
        "email_smtp_host": "",
        "email_smtp_port": "587",
        "email_smtp_user": "",
        "email_smtp_password": "",
        "email_from": "",
        "vpn_proxy_url": "",
        "scrape_via_vpn": "false",
    }
    try:
        for key, value in global_defaults.items():
            existing = db.query(Setting).filter(Setting.key == key).first()
            if not existing:
                db.add(Setting(key=key, value=value))
        db.commit()
    finally:
        db.close()


# Per-user setting keys and their defaults
USER_SETTING_DEFAULTS = {
    "notify_price_drop_threshold_pct": "5",
    "email_enabled": "false",
    "email_to": "",
    "discord_enabled": "false",
    "discord_webhook_url": "",
    "gotify_enabled": "false",
    "gotify_server_url": "",
    "gotify_app_token": "",
    "drakes_store_id": "087",
    "store_order": "",   # JSON array of store IDs in preferred order; "" = use global default
    "include_checklist_in_journey": "true",
}

# Global setting keys (admin-only)
GLOBAL_SETTING_KEYS = {
    "scrape_schedule_type",
    "scrape_schedule_time",
    "scrape_schedule_day",
    "email_smtp_host",
    "email_smtp_port",
    "email_smtp_user",
    "email_smtp_password",
    "email_from",
    "drakes_store_map",
    "vpn_proxy_url",
    "scrape_via_vpn",
}


def _migrate_settings_to_user():
    """Move per-user settings from global Setting table into UserSetting for the admin user."""
    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.role == "admin").order_by(User.id).first()
        if not admin:
            return
        per_user_keys = set(USER_SETTING_DEFAULTS.keys())
        for key in per_user_keys:
            existing_global = db.query(Setting).filter(Setting.key == key).first()
            existing_user = db.query(UserSetting).filter(
                UserSetting.user_id == admin.id, UserSetting.key == key
            ).first()
            if existing_global and not existing_user:
                db.add(UserSetting(user_id=admin.id, key=key, value=existing_global.value))
                db.delete(existing_global)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def get_user_setting(db, user_id: int, key: str) -> str | None:
    row = db.query(UserSetting).filter(
        UserSetting.user_id == user_id, UserSetting.key == key
    ).first()
    return row.value if row else USER_SETTING_DEFAULTS.get(key)


def get_global_setting(db, key: str) -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    if row:
        return row.value or ""
    # Fall back to seed defaults
    defaults = {
        "vpn_proxy_url": "",
        "scrape_via_vpn": "false",
    }
    return defaults.get(key, "")
