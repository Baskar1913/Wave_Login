from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.session import get_db
from app.models import Role, UserRole
from app.schemas.role import RoleCreate, RoleResponse, RoleUpdate
from app.routers.deps import require_role

router = APIRouter(prefix="/api/v1/roles", tags=["Roles"])


def role_manager(user=Depends(require_role("ADMIN", "SUPER_ADMIN"))):
    return user


def role_viewer(user=Depends(require_role("ADMIN", "SUPER_ADMIN"))):
    return user




@router.get("", response_model=list[RoleResponse])
def get_all(db: Session = Depends(get_db), viewer=Depends(role_viewer)):
    return db.scalars(select(Role).order_by(Role.id)).all()


@router.get("/{role_id}", response_model=RoleResponse)
def get_by_id(role_id: int, db: Session = Depends(get_db), viewer=Depends(role_viewer)):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    return role


@router.post("", response_model=RoleResponse, status_code=201)
def insert(data: RoleCreate, db: Session = Depends(get_db), manager=Depends(role_manager)):
    name = data.name.strip().upper()
    if db.scalar(select(Role).where(Role.name == name)):
        raise HTTPException(409, "Role already exists")
    role = Role(name=name, description=data.description.strip() if data.description else None)
    db.add(role)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Role already exists")
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=RoleResponse)
def update(role_id: int, data: RoleUpdate, db: Session = Depends(get_db), manager=Depends(role_manager)):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    if role.name in {"SUPER_ADMIN", "ADMIN", "CUSTOMER"}:
        raise HTTPException(403, "Core role cannot be modified")
    values = data.model_dump(exclude_unset=True)
    if "name" in values and values["name"]:
        new_name = values["name"].strip().upper()
        if new_name != role.name and db.scalar(select(Role).where(Role.name == new_name)):
            raise HTTPException(409, "Role already exists")
        values["name"] = new_name
    if "description" in values and values["description"] is not None:
        values["description"] = values["description"].strip()
    for key, value in values.items():
        setattr(role, key, value)
    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}")
def delete_by_id(role_id: int, db: Session = Depends(get_db), manager=Depends(role_manager)):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, "Role not found")
    if role.name in {"SUPER_ADMIN", "ADMIN", "CUSTOMER"}:
        raise HTTPException(403, "Core role cannot be deleted")
    assigned = db.scalar(select(UserRole).where(UserRole.role_id == role_id).limit(1))
    if assigned:
        raise HTTPException(409, "Role is assigned to users. Remove the assignments before deleting this role.")
    db.delete(role)
    db.commit()
    return {"message": "Role deleted successfully"}
