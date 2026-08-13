import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.common.schemas import ApiResponse, PageResponse
from app.core.database import get_db
from app.core.security import require_manager
from app.dashboard import service
from app.dashboard.schemas import (
    ApplicationStatsResponse,
    ManagerApplicationResponse,
    ManagerUserResponse,
    OverviewStatsResponse,
)
from app.resumes.schemas import RegisterResumeRequest, ResumeResponse, UploadUrlRequest, UploadUrlResponse
from app.tracking.enums import ApplicationStatus
from app.tracking.schemas import UpdateStatusRequest
from app.users.enums import AccountStatus

# All endpoints here require role = MANAGER, enforced once at the router level.
router = APIRouter(prefix="/api/manager", tags=["manager"], dependencies=[Depends(require_manager)])


@router.get("/stats/overview", response_model=ApiResponse[OverviewStatsResponse])
def overview(db: Session = Depends(get_db)) -> ApiResponse[OverviewStatsResponse]:
    return ApiResponse.of(service.get_overview(db))


@router.get("/stats/applications", response_model=ApiResponse[ApplicationStatsResponse])
def application_stats(
    userId: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
) -> ApiResponse[ApplicationStatsResponse]:
    return ApiResponse.of(service.get_application_stats(db, userId))


@router.get("/users", response_model=ApiResponse[PageResponse[ManagerUserResponse]])
def list_users(
    status: AccountStatus | None = Query(default=None),
    page: int = Query(default=0, ge=0),
    size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> ApiResponse[PageResponse[ManagerUserResponse]]:
    return ApiResponse.of(service.list_users(db, status, page, size))


@router.get("/applications", response_model=ApiResponse[PageResponse[ManagerApplicationResponse]])
def list_applications(
    userId: uuid.UUID | None = Query(default=None),
    status: ApplicationStatus | None = Query(default=None),
    page: int = Query(default=0, ge=0),
    size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> ApiResponse[PageResponse[ManagerApplicationResponse]]:
    return ApiResponse.of(service.list_all_applications(db, userId, status, page, size))


@router.get("/users/{user_id}", response_model=ApiResponse[ManagerUserResponse])
def get_user(user_id: uuid.UUID, db: Session = Depends(get_db)) -> ApiResponse[ManagerUserResponse]:
    return ApiResponse.of(service.get_user(db, user_id))


@router.patch("/users/{user_id}/approve", response_model=ApiResponse[ManagerUserResponse])
def approve(user_id: uuid.UUID, db: Session = Depends(get_db)) -> ApiResponse[ManagerUserResponse]:
    return ApiResponse.of(service.approve(db, user_id), "User approved")


@router.patch("/users/{user_id}/reject", response_model=ApiResponse[ManagerUserResponse])
def reject(user_id: uuid.UUID, db: Session = Depends(get_db)) -> ApiResponse[ManagerUserResponse]:
    return ApiResponse.of(service.reject(db, user_id), "User rejected")


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    service.delete_user(db, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Resume-on-file management ------------------------------------------------------------------
# The applicant must have a resume on file *before* a manager can approve their account (enforced
# in service.approve) — these mirror /api/resumes' presigned-upload flow, just scoped to a
# specific applicant (`user_id` from the path) rather than the caller's own account, since it's the
# manager uploading here, not the applicant.


@router.get("/users/{user_id}/resumes", response_model=ApiResponse[list[ResumeResponse]])
def list_user_resumes(user_id: uuid.UUID, db: Session = Depends(get_db)) -> ApiResponse[list[ResumeResponse]]:
    return ApiResponse.of(service.list_user_resumes(db, user_id))


@router.post("/users/{user_id}/resumes/upload-url", response_model=ApiResponse[UploadUrlResponse])
def create_user_resume_upload_url(
    user_id: uuid.UUID, request: UploadUrlRequest, db: Session = Depends(get_db)
) -> ApiResponse[UploadUrlResponse]:
    return ApiResponse.of(service.create_user_resume_upload_url(db, user_id, request))


@router.post("/users/{user_id}/resumes", response_model=ApiResponse[ResumeResponse], status_code=status.HTTP_201_CREATED)
def register_user_resume(
    user_id: uuid.UUID, request: RegisterResumeRequest, db: Session = Depends(get_db)
) -> ApiResponse[ResumeResponse]:
    return ApiResponse.of(service.register_user_resume(db, user_id, request), "Resume uploaded")


@router.delete("/users/{user_id}/resumes/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user_resume(user_id: uuid.UUID, resume_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    service.delete_user_resume(db, user_id, resume_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/applications/{application_id}/status", response_model=ApiResponse[ManagerApplicationResponse])
def update_application_status(
    application_id: uuid.UUID,
    request: UpdateStatusRequest,
    db: Session = Depends(get_db),
) -> ApiResponse[ManagerApplicationResponse]:
    return ApiResponse.of(service.update_application_status(db, application_id, request.status), "Status updated")


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    service.delete_application(db, application_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
