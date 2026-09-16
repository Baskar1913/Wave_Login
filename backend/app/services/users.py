from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import User, Role, UserRole
from app.core.security import hash_password
from app.schemas.user import UserCreate, UserUpdate

DEFAULT_ROLES = [
    "SUPER_ADMIN",
    "ADMIN",
    "CLIENT",
    "CUSTOMER",
    "SELLER",
    "SHIPPER",
    "DELIVERY_MANAGER",
    "DELIVERY_EXECUTIVE",
    "WAREHOUSE_MANAGER",
    "INVENTORY_MANAGER",
    "CUSTOMER_SUPPORT",
    "FINANCE_MANAGER",
]

DESCRIPTIONS = {
    "SUPER_ADMIN": "Single system owner who manages administrator accounts and controlled platform access.",
    "ADMIN": "Administrator who manages users, assigns business roles and maintains operational access.",
    "CLIENT": "Business client or account owner using Wave services.",
    "CUSTOMER": "Standard customer account created through public signup or by an administrator.",
    "SELLER": "Seller or merchant responsible for products and seller-side operations.",
    "SHIPPER": "Shipping or delivery partner responsible for shipment activities.",
    "DELIVERY_MANAGER": "Manages delivery operations, assignments and delivery performance.",
    "DELIVERY_EXECUTIVE": "Handles assigned deliveries and updates delivery status.",
    "WAREHOUSE_MANAGER": "Manages warehouse operations, dispatch and stock movement.",
    "INVENTORY_MANAGER": "Maintains inventory levels, stock records and availability.",
    "CUSTOMER_SUPPORT": "Handles customer questions, complaints, returns and support requests.",
    "FINANCE_MANAGER": "Oversees payments, invoices, refunds and financial operations.",
}

PROTECTED_ROLES = {"SUPER_ADMIN", "ADMIN"}


def seed_roles(db: Session):
    changed = False
    for name in DEFAULT_ROLES:
        role = db.scalar(select(Role).where(Role.name == name))
        if not role:
            db.add(Role(name=name, description=DESCRIPTIONS[name]))
            changed = True
        elif not role.description:
            role.description = DESCRIPTIONS[name]
            changed = True
    if changed:
        db.commit()


def get_roles(user: User) -> list[str]:
    return [ur.role.name for ur in user.user_roles]


def user_out(user: User):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "username": user.username,
        "mobile": user.mobile,
        "address": user.address,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "roles": get_roles(user),
    }


def get_user(db: Session, user_id: int):
    return db.scalar(select(User).where(User.id == user_id))


def _duplicate_message(db: Session, email: str, username: str, mobile: str, exclude_id: int | None = None):
    conditions = [User.email == email, User.username == username, User.mobile == mobile]
    query = select(User).where(or_(*conditions))
    if exclude_id is not None:
        query = query.where(User.id != exclude_id)
    existing = db.scalar(query)
    if existing:
        if existing.email == email:
            return "User already exists with this email address."
        if existing.username == username:
            return "User already exists with this username."
        return "User already exists with this mobile number."
    return None


def create_user(db: Session, data: UserCreate, role_name: str | None = None, assigned_by=None):
    email = str(data.email).strip().lower()
    username = data.username.strip()
    mobile = data.mobile.strip()
    duplicate = _duplicate_message(db, email, username, mobile)
    if duplicate:
        raise HTTPException(409, duplicate)

    role = None
    if role_name:
        role_name = role_name.upper().strip()
        role = db.scalar(select(Role).where(Role.name == role_name))
        if not role:
            raise HTTPException(500, "Role is not configured")

    user = User(
        name=data.name.strip(),
        email=email,
        username=username,
        mobile=mobile,
        address=data.address.strip() if data.address else None,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.flush()
    if role:
        db.add(UserRole(user_id=user.id, role_id=role.id, assigned_by=assigned_by))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        text = str(exc.orig).lower()
        if "email" in text:
            raise HTTPException(409, "User already exists with this email address.")
        if "username" in text:
            raise HTTPException(409, "User already exists with this username.")
        raise HTTPException(409, "A user with the supplied primary information already exists.")
    db.refresh(user)
    return user


def update_user(db: Session, user: User, data: UserUpdate):
    values = data.model_dump(exclude_unset=True)

    email = str(values["email"]).strip().lower() if values.get("email") is not None else user.email
    username = values["username"].strip() if values.get("username") is not None else user.username
    mobile = values["mobile"].strip() if values.get("mobile") is not None else user.mobile
    duplicate = _duplicate_message(db, email, username, mobile, user.id)
    if duplicate:
        raise HTTPException(409, duplicate)

    if "email" in values and values["email"] is not None:
        values["email"] = email
    if "username" in values and values["username"] is not None:
        values["username"] = username
    if "mobile" in values and values["mobile"] is not None:
        values["mobile"] = mobile
    if values.get("password"):
        values["password_hash"] = hash_password(values.pop("password"))

    for key, value in values.items():
        setattr(user, key, value.strip() if isinstance(value, str) and key not in {"email", "username", "mobile", "password_hash"} else value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        text = str(exc.orig).lower()
        if "email" in text:
            raise HTTPException(409, "User already exists with this email address.")
        if "username" in text:
            raise HTTPException(409, "User already exists with this username.")
        raise HTTPException(409, "A user with the supplied primary information already exists.")
    db.refresh(user)
    return user
