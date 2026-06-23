import logging
import os
from contextlib import asynccontextmanager
from logging.handlers import TimedRotatingFileHandler

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import init_db, SessionLocal, Setting
from routers import items, products, journey, settings, stores, checklist
from routers import auth as auth_router, logs as logs_router
import scheduler as sched
from log_buffer import LogBufferHandler

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_LOG_FMT = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s", datefmt="%H:%M:%S")

_buf_handler = LogBufferHandler()
_buf_handler.setFormatter(_LOG_FMT)
logging.getLogger().addHandler(_buf_handler)

_LOG_FILE = "/data/tightarse.log"
os.makedirs(os.path.dirname(_LOG_FILE), exist_ok=True)
_file_handler = TimedRotatingFileHandler(_LOG_FILE, when="midnight", backupCount=7, encoding="utf-8")
_file_handler.setFormatter(_LOG_FMT)
logging.getLogger().addHandler(_file_handler)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising database…")
    init_db()

    db = SessionLocal()
    try:
        def _gs(key, default=""):
            row = db.query(Setting).filter(Setting.key == key).first()
            return row.value if row and row.value else default
        schedule_type = _gs("scrape_schedule_type", "6h")
        schedule_time = _gs("scrape_schedule_time", "06:00")
        schedule_day = _gs("scrape_schedule_day", "mon")
    finally:
        db.close()

    logger.info(f"Starting scheduler (type={schedule_type} time={schedule_time} day={schedule_day})…")
    sched.start_scheduler(schedule_type, schedule_time, schedule_day)

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

api = APIRouter(prefix="/api")
api.include_router(auth_router.router)
api.include_router(items.router)
api.include_router(products.router)
api.include_router(journey.router)
api.include_router(settings.router)
api.include_router(stores.router)
api.include_router(checklist.router)
api.include_router(logs_router.router)
app.include_router(api)


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve frontend static files if built into the image
if os.path.isdir(FRONTEND_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def spa(full_path: str):
        file_path = os.path.join(FRONTEND_DIR, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
