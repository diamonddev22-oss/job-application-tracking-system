import uuid

from fastapi import APIRouter, Depends, Query

from app.common.schemas import ApiResponse, PageResponse
from app.core.database import get_db
from app.core.security import get_current_user
from app.tracking import service
from app.tracking.enums import ApplicationStatus
from app.tracking.schemas import (
    ApplicationEventRequest,
    ApplicationEventResponse,
    ApplicationHistoryResponse,
    JobApplicationResponse,
    ScreenshotUploadUrlRequest,
    ScreenshotUploadUrlResponse,
    UpdateStatusRequest,
)
from app.users.models import User
from sqlalchemy.orm import Session

applications_router = APIRouter(prefix="/api/applications", tags=["applications"])

# The single entry point the Chrome extension calls. Response shape is a fixed external contract
# (no ApiResponse envelope) - see docs/system-design.md.
events_router = APIRouter(prefix="/api/application-events", tags=["application-events"])


@events_router.post("", response_model=ApplicationEventResponse)
def record_event(
    request: ApplicationEventRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApplicationEventResponse:
    return service.record_event(db, current_user, request)


# Unlike the raw-contract endpoint above, this one is only ever called by the extension itself
# (never parsed as a fixed external shape by anything else), so it uses the standard ApiResponse
# envelope like every other authenticated endpoint in the app.
@events_router.post("/screenshot-upload-url", response_model=ApiResponse[ScreenshotUploadUrlResponse])
def create_screenshot_upload_url(
    request: ScreenshotUploadUrlRequest, current_user: User = Depends(get_current_user)
) -> ApiResponse[ScreenshotUploadUrlResponse]:
    return ApiResponse.of(service.create_screenshot_upload_url(current_user.id, request))


@applications_router.get("", response_model=ApiResponse[PageResponse[JobApplicationResponse]])
def list_applications(
    status: ApplicationStatus | None = Query(default=None),
    page: int = Query(default=0, ge=0),
    size: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[PageResponse[JobApplicationResponse]]:
    return ApiResponse.of(service.list_applications(db, current_user.id, status, page, size))


@applications_router.get("/{application_id}", response_model=ApiResponse[JobApplicationResponse])
def get_application(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[JobApplicationResponse]:
    return ApiResponse.of(service.get_application(db, current_user.id, application_id))


@applications_router.patch("/{application_id}/status", response_model=ApiResponse[JobApplicationResponse])
def update_status(
    application_id: uuid.UUID,
    request: UpdateStatusRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[JobApplicationResponse]:
    updated = service.update_status(db, current_user.id, application_id, request.status)
    return ApiResponse.of(updated, "Status updated")


@applications_router.get("/{application_id}/history", response_model=ApiResponse[list[ApplicationHistoryResponse]])
def get_history(
    application_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[list[ApplicationHistoryResponse]]:
    return ApiResponse.of(service.get_history(db, current_user.id, application_id))
