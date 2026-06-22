import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, SessionLocal, Setting
from routers import items, products, journey, settings, stores
from routers import auth as auth_router
import scheduler as sched

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising database…")
    init_db()

    db = SessionLocal()
    try:
        interval_row = db.query(Setting).filter(Setting.key == "scrape_interval_hours").first()
        interval = float(interval_row.value) if interval_row else 6.0
    finally:
        db.close()

    logger.info(f"Starting scheduler (interval={interval}h)…")
    sched.start_scheduler(interval)

    yield

    logger.info("Shutting down scheduler…")
    if sched.scheduler.running:
        sched.scheduler.shutdown(wait=False)


app = FastAPI(title="Tightarse", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(items.router)
app.include_router(products.router)
app.include_router(journey.router)
app.include_router(settings.router)
app.include_router(stores.router)


@app.get("/health")
def health():
    return {"status": "ok"}
