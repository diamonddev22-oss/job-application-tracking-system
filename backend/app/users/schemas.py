import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.users.enums import AccountStatus, Role


class UserSummaryResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    status: AccountStatus
    createdAt: datetime


class ProfileResponse(BaseModel):
    name: str | None
    location: str | None
    skills: str | None
    experience: str | None
    updatedAt: datetime


class ProfileUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=150)
    location: str | None = Field(default=None, max_length=150)
    skills: str | None = Field(default=None, max_length=2000)
    experience: str | None = Field(default=None, max_length=4000)
