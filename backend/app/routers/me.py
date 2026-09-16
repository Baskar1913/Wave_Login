from fastapi import APIRouter, Depends
from app.routers.deps import current_user
from app.services.users import user_out
router = APIRouter(prefix="/api/v1", tags=["Current User"])
@router.get("/me")
def me(user=Depends(current_user)): return user_out(user)
