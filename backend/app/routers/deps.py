from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import User
from app.core.security import decode_token

bearer = HTTPBearer(auto_error=False)

def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)):
    if not credentials: raise HTTPException(status_code=401, detail="Authentication required")
    try: user_id = decode_token(credentials.credentials)
    except Exception: raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.scalar(select(User).where(User.id == user_id))
    if not user or not user.is_active: raise HTTPException(status_code=401, detail="User not found or inactive")
    return user

def require_role(*allowed: str) -> Callable:
    def checker(user=Depends(current_user)):
        roles = {ur.role.name for ur in user.user_roles}
        if not roles.intersection(allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission for this action")
        return user
    return checker
