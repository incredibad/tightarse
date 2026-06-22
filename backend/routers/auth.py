from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, User, UserSetting, USER_SETTING_DEFAULTS
from auth import hash_password, verify_password, create_token, require_auth, require_admin

router = APIRouter(prefix="/auth", tags=["auth"])


class SetupPayload(BaseModel):
    username: str
    password: str


class LoginPayload(BaseModel):
    username: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class StatusOut(BaseModel):
    setup_required: bool


class MeOut(BaseModel):
    id: int
    username: str
    role: str


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CreateUserPayload(BaseModel):
    username: str
    password: str
    role: str = "user"


class UpdateUserPayload(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class ResetPasswordPayload(BaseModel):
    new_password: str


@router.get("/status", response_model=StatusOut)
def auth_status(db: Session = Depends(get_db)):
    has_user = db.query(User).first() is not None
    return StatusOut(setup_required=not has_user)


@router.post("/setup", response_model=TokenOut)
def setup(payload: SetupPayload, db: Session = Depends(get_db)):
    if db.query(User).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Setup already complete")
    if not payload.username.strip() or not payload.password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Username and password required")
    if len(payload.password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 8 characters")

    user = User(username=payload.username.strip(), hashed_password=hash_password(payload.password), role="admin")
    db.add(user)
    db.flush()
    # Seed per-user defaults for the admin
    for key, value in USER_SETTING_DEFAULTS.items():
        db.add(UserSetting(user_id=user.id, key=key, value=value))
    db.commit()
    return TokenOut(access_token=create_token(user.username, db))


@router.post("/login", response_model=TokenOut)
def login(payload: LoginPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
    return TokenOut(access_token=create_token(user.username, db))


@router.get("/me", response_model=MeOut)
def me(current_user: User = Depends(require_auth)):
    return MeOut(id=current_user.id, username=current_user.username, role=current_user.role)


class ChangePasswordPayload(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password", status_code=204)
def change_password(
    payload: ChangePasswordPayload,
    current_user: User = Depends(require_auth),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Password must be at least 8 characters")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()


# ── Admin user management ────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserOut])
def list_users(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.created_at).all()


@router.post("/users", response_model=UserOut, status_code=201)
def create_user(
    payload: CreateUserPayload,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not payload.username.strip() or not payload.password:
        raise HTTPException(status_code=422, detail="Username and password required")
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    if payload.role not in ("admin", "user"):
        raise HTTPException(status_code=422, detail="Role must be 'admin' or 'user'")
    if db.query(User).filter(User.username == payload.username.strip()).first():
        raise HTTPException(status_code=409, detail="Username already taken")

    user = User(
        username=payload.username.strip(),
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.flush()
    for key, value in USER_SETTING_DEFAULTS.items():
        db.add(UserSetting(user_id=user.id, key=key, value=value))
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UpdateUserPayload,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and payload.role == "user":
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    if payload.role is not None:
        if payload.role not in ("admin", "user"):
            raise HTTPException(status_code=422, detail="Role must be 'admin' or 'user'")
        user.role = payload.role
    if payload.is_active is not None:
        if user.id == admin.id and not payload.is_active:
            raise HTTPException(status_code=400, detail="Cannot disable yourself")
        user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/reset-password", status_code=204)
def reset_user_password(
    user_id: int,
    payload: ResetPasswordPayload,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    db.delete(user)
    db.commit()
