from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Item
from auth import require_auth, User

router = APIRouter(prefix="/items", tags=["items"])


class ItemCreate(BaseModel):
    name: str
    category: str | None = None


class ItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None


class ItemOut(BaseModel):
    id: int
    name: str
    category: str | None
    created_at: datetime

    class Config:
        from_attributes = True


def _own(db: Session, item_id: int, user_id: int) -> Item:
    item = db.query(Item).filter(Item.id == item_id, Item.user_id == user_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.get("/", response_model=list[ItemOut])
def list_items(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    return db.query(Item).filter(Item.user_id == current_user.id).order_by(Item.name).all()


@router.post("/", response_model=ItemOut, status_code=201)
def create_item(payload: ItemCreate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    item = Item(name=payload.name.strip(), category=payload.category, user_id=current_user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    return _own(db, item_id, current_user.id)


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    item = _own(db, item_id, current_user.id)
    if payload.name is not None:
        item.name = payload.name.strip()
    if payload.category is not None:
        item.category = payload.category
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    item = _own(db, item_id, current_user.id)
    db.delete(item)
    db.commit()
