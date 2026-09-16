from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import Role, User, UserRole
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.users import create_user, get_user, get_roles, update_user, user_out
from app.routers.deps import require_role

router = APIRouter(prefix="/api/v1/users", tags=["Users"])


def user_manager(user=Depends(require_role("ADMIN", "SUPER_ADMIN"))):
    return user


def admin_manager(user=Depends(require_role("ADMIN", "SUPER_ADMIN"))):
    return user


def normal_user(user: User) -> bool:
    return not set(get_roles(user)).intersection({"ADMIN", "SUPER_ADMIN"})


@router.get("", response_model=list[UserResponse])
def get_all(db: Session = Depends(get_db), manager=Depends(user_manager)):
    users = db.scalars(select(User).order_by(User.id.desc())).unique().all()
    return [user_out(u) for u in users if normal_user(u)]


@router.get("/{user_id}", response_model=UserResponse)
def get_by_id(user_id: int, db: Session = Depends(get_db), manager=Depends(user_manager)):
    user = get_user(db, user_id)
    if not user or not normal_user(user):
        raise HTTPException(404, "User not found")
    return user_out(user)


@router.post("", response_model=UserResponse, status_code=201)
def insert(data: UserCreate, db: Session = Depends(get_db), manager=Depends(user_manager)):
    return user_out(create_user(db, data, None, manager.id))


@router.put("/{user_id}", response_model=UserResponse)
def update(user_id: int, data: UserUpdate, db: Session = Depends(get_db), admin=Depends(admin_manager)):
    user = get_user(db, user_id)
    if not user or not normal_user(user):
        raise HTTPException(404, "User not found")
    return user_out(update_user(db, user, data))


@router.delete("/{user_id}")
def delete_by_id(user_id: int, db: Session = Depends(get_db), admin=Depends(admin_manager)):
    user = get_user(db, user_id)
    if not user or not normal_user(user):
        raise HTTPException(404, "User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


@router.get("/{user_id}/roles", response_model=list[str])
def get_user_roles(user_id: int, db: Session = Depends(get_db), manager=Depends(user_manager)):
    user = get_user(db, user_id)
    if not user or not normal_user(user):
        raise HTTPException(404, "User not found")
    return get_roles(user)


@router.post("/{user_id}/roles", response_model=UserResponse)
def assign_role(user_id: int, role_name: str, db: Session = Depends(get_db), manager=Depends(user_manager)):
    user = get_user(db, user_id)
    role = db.scalar(select(Role).where(Role.name == role_name.strip().upper()))
    if not user or not normal_user(user):
        raise HTTPException(404, "User not found")
    if not role:
        raise HTTPException(404, "Role not found")
    if role.name in {"SUPER_ADMIN", "ADMIN"}:
        raise HTTPException(403, "Administrator roles are managed separately and cannot be assigned here")
    if db.scalar(select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role.id)):
        raise HTTPException(409, f"{role.name} role is already assigned to this user")
    db.add(UserRole(user_id=user_id, role_id=role.id, assigned_by=manager.id))
    db.commit()
    db.refresh(user)
    return user_out(user)


@router.delete("/{user_id}/roles/{role_id}", response_model=UserResponse)
def remove_role(user_id: int, role_id: int, db: Session = Depends(get_db), admin=Depends(admin_manager)):
    link = db.scalar(select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == role_id))
    if not link:
        raise HTTPException(404, "Role assignment not found")
    role = db.get(Role, role_id)
    if role and role.name in {"SUPER_ADMIN", "ADMIN", "CUSTOMER"}:
        raise HTTPException(403, "Core role assignment cannot be removed")
    db.delete(link)
    db.commit()
    user = get_user(db, user_id)
    return user_out(user)
