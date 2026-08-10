import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.tracking.enums import ApplicationEventStatus, ApplicationStatus, EventType

_ALLOWED_SCREENSHOT_CONTENT_TYPES = {"image/png", "image/jpeg"}


class ApplicationEventRequest(BaseModel):
    """Matches the JSON contract the Chrome extension's background/popup scripts already send."""

    eventType: EventType
    company: str = Field(min_length=1, max_length=255)
    jobTitle: str = Field(min_length=1, max_length=255)
    jobUrl: str = Field(min_length=1, max_length=2048)
    timestamp: datetime
    # The key returned by POST /application-events/screenshot-upload-url, after the extension has
    # already PUT the screenshot bytes there directly — never a raw file, to keep this endpoint
    # (and its response contract, which the extension parses as a fixed external shape) unchanged
    # for callers that don't send one. See ScreenshotUploadUrlRequest/Response below.
    screenshotKey: str | None = Field(default=None, max_length=1024)


class ScreenshotUploadUrlRequest(BaseModel):
    contentType: str

    @field_validator("contentType")
    @classmethod
    def validate_content_type(cls, value: str) -> str:
        if value not in _ALLOWED_SCREENSHOT_CONTENT_TYPES:
            raise ValueError("Only PNG and JPEG screenshots are supported")
        return value


class ScreenshotUploadUrlResponse(BaseModel):
    """The client must PUT the screenshot to uploadUrl with an identical Content-Type header (it's
    part of the signed request), then pass `key` back as `screenshotKey` on POST /application-events."""

    uploadUrl: str
    key: str
    expiresAt: datetime


class ApplicationEventResponse(BaseModel):
    """Returned as-is (no ApiResponse envelope) - this is the documented external contract the
    Chrome extension parses directly."""

    status: ApplicationEventStatus
    message: str

    @classmethod
    def success(cls) -> "ApplicationEventResponse":
        return cls(status=ApplicationEventStatus.SUCCESS, message="Application tracked successfully")

    @classmethod
    def duplicate(cls) -> "ApplicationEventResponse":
        return cls(status=ApplicationEventStatus.DUPLICATE, message="Application already exists")


class JobApplicationResponse(BaseModel):
    id: uuid.UUID
    company: str
    jobTitle: str
    jobUrl: str
    status: ApplicationStatus
    appliedDate: date
    screenshotUrl: str | None
    createdAt: datetime
    updatedAt: datetime


class UpdateStatusRequest(BaseModel):
    status: ApplicationStatus


class ApplicationHistoryResponse(BaseModel):
    id: uuid.UUID
    oldStatus: ApplicationStatus | None
    newStatus: ApplicationStatus
    changedAt: datetime
