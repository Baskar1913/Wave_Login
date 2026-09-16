from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class UserBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    username: str = Field(min_length=3, max_length=80)
    mobile: str = Field(min_length=5, max_length=30)
    address: str | None = Field(default=None, max_length=500)

class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)

class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    username: str | None = Field(default=None, min_length=3, max_length=80)
    mobile: str | None = Field(default=None, min_length=5, max_length=30)
    address: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    roles: list[str] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)

class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None
    model_config = ConfigDict(from_attributes=True)
