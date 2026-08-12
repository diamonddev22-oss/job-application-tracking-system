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
from app.tracking.enums import ApplicationStatus
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


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: uuid.UUID, db: Session = Depends(get_db)) -> Response:
    service.delete_application(db, application_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
