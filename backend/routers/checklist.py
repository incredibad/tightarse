from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, ChecklistItem
from auth import require_auth, User

router = APIRouter(prefix="/checklist", tags=["checklist"])


class ChecklistItemOut(BaseModel):
    id: int
    name: str
    checked: bool
    position: int

    class Config:
        from_attributes = True


class ChecklistItemCreate(BaseModel):
    name: str


class ChecklistItemUpdate(BaseModel):
    name: str | None = None
    checked: bool | None = None
    position: int | None = None


@router.get("/", response_model=list[ChecklistItemOut])
def list_items(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    return (
        db.query(ChecklistItem)
        .filter(ChecklistItem.user_id == current_user.id)
        .order_by(ChecklistItem.checked, ChecklistItem.id.desc())
        .all()
    )


@router.post("/", response_model=ChecklistItemOut, status_code=201)
def create_item(payload: ChecklistItemCreate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    max_pos = db.query(ChecklistItem).filter(
        ChecklistItem.user_id == current_user.id, ChecklistItem.checked == False
    ).count()
    item = ChecklistItem(user_id=current_user.id, name=payload.name.strip(), position=max_pos)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ChecklistItemOut)
def update_item(item_id: int, payload: ChecklistItemUpdate, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id, ChecklistItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if payload.name is not None:
        item.name = payload.name.strip()
    if payload.checked is not None:
        item.checked = payload.checked
    if payload.position is not None:
        item.position = payload.position
    db.commit()
    db.refresh(item)
    return item


@router.delete("/checked", status_code=204)
def clear_checked(current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    db.query(ChecklistItem).filter(
        ChecklistItem.user_id == current_user.id, ChecklistItem.checked == True
    ).delete()
    db.commit()


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, current_user: User = Depends(require_auth), db: Session = Depends(get_db)):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id, ChecklistItem.user_id == current_user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
