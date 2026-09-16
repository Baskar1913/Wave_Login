from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import User
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse
from app.schemas.user import UserCreate
from app.services.users import create_user, user_out
from app.core.security import create_access_token, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    try:
        data.validate_passwords()
    except ValueError as e:
        raise HTTPException(422, str(e))
    user = create_user(
        db,
        UserCreate(
            name=data.name,
            email=data.email,
            username=data.username,
            mobile=data.phone,
            address=None,
            password=data.password,
        ),
        None,
    )
    return {"access_token": create_access_token(user.id), "user": user_out(user)}


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    raw_identifier = data.username_or_email.strip()
    identifier = raw_identifier.lower()
    user = db.scalar(
        select(User).where(
            or_(User.email == identifier, User.username == raw_identifier)
        )
    )
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Your account is inactive")

    roles = {ur.role.name for ur in user.user_roles}
    if data.login_as == "SUPER_ADMIN" and "SUPER_ADMIN" not in roles:
        raise HTTPException(status_code=403, detail="This account is not a Super Admin account")
    if data.login_as == "ADMIN" and "ADMIN" not in roles:
        raise HTTPException(status_code=403, detail="This account is not an Admin account")
    if data.login_as == "USER" and roles.intersection({"SUPER_ADMIN", "ADMIN"}):
        raise HTTPException(status_code=403, detail="Use the Admin or Super Admin login")

    return {"access_token": create_access_token(user.id), "user": user_out(user)}
