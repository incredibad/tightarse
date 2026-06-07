from datetime import datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Text, event
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy.engine import Engine

DATABASE_URL = "sqlite:////data/tightarse.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
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

    products = relationship("Product", back_populates="store")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False, unique=True)
    current_price = Column(Float, nullable=True)
    last_scraped_at = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True)

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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _seed_stores()
    _seed_default_settings()


def _seed_stores():
    db = SessionLocal()
    try:
        stores = [
            Store(name="Woolworths", base_url="https://www.woolworths.com.au", scraper_module="woolworths"),
            Store(name="Coles", base_url="https://www.coles.com.au", scraper_module="coles"),
            Store(name="ALDI", base_url="https://www.aldi.com.au", scraper_module="aldi"),
            Store(name="IGA", base_url="https://www.iga.com.au", scraper_module="iga"),
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
    defaults = {
        "scrape_interval_hours": "6",
        "notify_price_drop_threshold_pct": "5",
        "email_enabled": "false",
        "email_smtp_host": "",
        "email_smtp_port": "587",
        "email_smtp_user": "",
        "email_smtp_password": "",
        "email_to": "",
        "discord_enabled": "false",
        "discord_webhook_url": "",
        "gotify_enabled": "false",
        "gotify_server_url": "",
        "gotify_app_token": "",
    }
    try:
        for key, value in defaults.items():
            existing = db.query(Setting).filter(Setting.key == key).first()
            if not existing:
                db.add(Setting(key=key, value=value))
        db.commit()
    finally:
        db.close()
