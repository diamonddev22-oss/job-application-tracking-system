import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

_ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class UploadUrlRequest(BaseModel):
    fileName: str = Field(min_length=1, max_length=255)
    contentType: str

    @field_validator("contentType")
    @classmethod
    def validate_content_type(cls, value: str) -> str:
        if value not in _ALLOWED_CONTENT_TYPES:
            raise ValueError("Only PDF and Word documents are supported")
        return value


class UploadUrlResponse(BaseModel):
    """The client must PUT the file to uploadUrl with an identical Content-Type header (it's part
    of the signed request), then call POST /resumes with key."""

    uploadUrl: str
    key: str
    fileUrl: str
    expiresAt: datetime


class RegisterResumeRequest(BaseModel):
    key: str = Field(min_length=1)


class ResumeResponse(BaseModel):
    id: uuid.UUID
    fileUrl: str
    version: int
    createdAt: datetime
