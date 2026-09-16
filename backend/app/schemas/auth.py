from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=30)
    username: str = Field(min_length=3, max_length=80)
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @field_validator("username")
    @classmethod
    def clean_username(cls, v):
        v = v.strip()
        if " " in v:
            raise ValueError("Username cannot contain spaces")
        return v

    def validate_passwords(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")


class LoginRequest(BaseModel):
    username_or_email: str = Field(min_length=3)
    password: str = Field(min_length=1)
    login_as: Literal["SUPER_ADMIN", "ADMIN", "USER"] = "USER"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


from app.schemas.user import UserResponse
TokenResponse.model_rebuild()
