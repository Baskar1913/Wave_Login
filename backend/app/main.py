import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.core.config import settings
from app.db.session import Base, engine, SessionLocal
from app.db.bootstrap import ensure_schema_compatibility
from app.models import Role, User, UserRole
from app.services.users import seed_roles
from app.core.security import hash_password
from app.routers import auth, users, admins, roles, me


def ensure_default_super_admin(db):
    """
    Create the default Super Admin automatically if one does not exist.
    This runs every time the backend starts, but only creates the account once.
    """

    role = db.scalar(
        select(Role).where(Role.name == "SUPER_ADMIN")
    )

    if not role:
        return

    # Check whether a Super Admin already exists
    existing = db.scalar(
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .where(UserRole.role_id == role.id)
    )

    if existing:
        return

    # Read initial Super Admin details from environment variables
    name = os.getenv("DEFAULT_SUPER_ADMIN_NAME", "Super Admin").strip()
    email = os.getenv("DEFAULT_SUPER_ADMIN_EMAIL", "").strip().lower()
    username = os.getenv("DEFAULT_SUPER_ADMIN_USERNAME", "").strip()
    mobile = os.getenv("DEFAULT_SUPER_ADMIN_MOBILE", "").strip()
    password = os.getenv("DEFAULT_SUPER_ADMIN_PASSWORD", "")

    # Do not create an incomplete Super Admin
    if not email or not username or not password:
        print(
            "WARNING: Default Super Admin was not created. "
            "DEFAULT_SUPER_ADMIN_EMAIL, "
            "DEFAULT_SUPER_ADMIN_USERNAME and "
            "DEFAULT_SUPER_ADMIN_PASSWORD are required."
        )
        return

    if len(password) < 8:
        raise RuntimeError(
            "DEFAULT_SUPER_ADMIN_PASSWORD must contain at least 8 characters."
        )

    # Prevent duplicate account information
    duplicate = db.scalar(
        select(User).where(
            (User.email == email)
            | (User.username == username)
            | (User.mobile == mobile)
        )
    )

    if duplicate:
        print(
            "WARNING: Default Super Admin could not be created because "
            "the email, username or mobile already exists."
        )
        return

    user = User(
        name=name,
        email=email,
        username=username,
        mobile=mobile,
        address=None,
        password_hash=hash_password(password),
    )

    db.add(user)
    db.flush()

    db.add(
        UserRole(
            user_id=user.id,
            role_id=role.id,
        )
    )

    db.commit()

    print(f"Default Super Admin '{username}' created successfully.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility(engine)

    db = SessionLocal()

    try:
        # Create core/business roles
        seed_roles(db)

        # Create the initial Super Admin if necessary
        ensure_default_super_admin(db)

    finally:
        db.close()

    yield


app = FastAPI(
    title="Wave API",
    version="1.0.0",
    description="Role-based user management API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(admins.router)
app.include_router(roles.router)
app.include_router(me.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "wave-api"}