from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Setting
import scheduler as sched

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingOut(BaseModel):
    key: str
    value: str | None

    class Config:
        from_attributes = True


class SettingsBulkUpdate(BaseModel):
    settings: dict[str, str]


@router.get("/", response_model=list[SettingOut])
def list_settings(db: Session = Depends(get_db)):
    return db.query(Setting).order_by(Setting.key).all()


@router.get("/{key}", response_model=SettingOut)
def get_setting(key: str, db: Session = Depends(get_db)):
    s = db.query(Setting).filter(Setting.key == key).first()
    if not s:
        raise HTTPException(status_code=404, detail="Setting not found")
    return s


@router.put("/", response_model=list[SettingOut])
def update_settings(payload: SettingsBulkUpdate, db: Session = Depends(get_db)):
    updated = []
    for key, value in payload.settings.items():
        s = db.query(Setting).filter(Setting.key == key).first()
        if s:
            s.value = value
        else:
            s = Setting(key=key, value=value)
            db.add(s)
        updated.append(s)

    db.commit()

    # Re-apply scrape interval if it changed
    if "scrape_interval_hours" in payload.settings:
        try:
            hours = float(payload.settings["scrape_interval_hours"])
            sched.reschedule(hours)
        except ValueError:
            pass

    return updated
