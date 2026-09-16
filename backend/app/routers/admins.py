from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import Role, User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.users import create_user, get_roles, get_user, update_user, user_out
from app.routers.deps import require_role

router = APIRouter(prefix="/api/v1/admins", tags=["Administrators"])


def admins_query(db):
    return db.scalars(
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .join(Role, Role.id == UserRole.role_id)
        .where(Role.name == "ADMIN")
        .order_by(User.id.desc())
    ).unique().all()


@router.get("", response_model=list[UserResponse])
def get_all(db: Session = Depends(get_db), super_admin=Depends(require_role("SUPER_ADMIN"))):
    return [user_out(u) for u in admins_query(db)]


@router.get("/{admin_id}", response_model=UserResponse)
def get_by_id(admin_id: int, db: Session = Depends(get_db), super_admin=Depends(require_role("SUPER_ADMIN"))):
    user = get_user(db, admin_id)
    if not user or "ADMIN" not in get_roles(user):
        raise HTTPException(404, "Admin not found")
    return user_out(user)


@router.post("", response_model=UserResponse, status_code=201)
def insert(data: UserCreate, db: Session = Depends(get_db), super_admin=Depends(require_role("SUPER_ADMIN"))):
    return user_out(create_user(db, data, "ADMIN", super_admin.id))


@router.put("/{admin_id}", response_model=UserResponse)
def update(admin_id: int, data: UserUpdate, db: Session = Depends(get_db), super_admin=Depends(require_role("SUPER_ADMIN"))):
    user = get_user(db, admin_id)
    if not user or "ADMIN" not in get_roles(user):
        raise HTTPException(404, "Admin not found")
    return user_out(update_user(db, user, data))


@router.delete("/{admin_id}")
def delete_by_id(admin_id: int, db: Session = Depends(get_db), super_admin=Depends(require_role("SUPER_ADMIN"))):
    user = get_user(db, admin_id)
    if not user or "ADMIN" not in get_roles(user):
        raise HTTPException(404, "Admin not found")
    db.delete(user)
    db.commit()
    return {"message": "Admin deleted successfully"}
