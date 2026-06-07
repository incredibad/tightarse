from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Store

router = APIRouter(prefix="/stores", tags=["stores"])


class StoreOut(BaseModel):
    id: int
    name: str
    base_url: str
    scraper_module: str

    class Config:
        from_attributes = True


@router.get("/", response_model=list[StoreOut])
def list_stores(db: Session = Depends(get_db)):
    return db.query(Store).order_by(Store.name).all()
