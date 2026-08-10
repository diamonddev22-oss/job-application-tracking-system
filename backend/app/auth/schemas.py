import uuid

from pydantic import BaseModel, EmailStr, Field

from app.users.enums import AccountStatus, Role


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class AuthResponse(BaseModel):
    token: str
    id: uuid.UUID
    email: str
    role: Role
    status: AccountStatus
