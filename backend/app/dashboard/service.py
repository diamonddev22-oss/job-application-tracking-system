import uuid
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.common.pagination import paginate
from app.common.schemas import PageResponse
from app.core.exceptions import ResourceNotFoundException
from app.dashboard.schemas import (
    ApplicationStatsResponse,
    DailyApplicationCount,
    ManagerApplicationResponse,
    ManagerUserResponse,
    OverviewStatsResponse,
)
from app.resumes.models import Resume
from app.resumes.storage import ResumeStorage
from app.tracking.enums import ApplicationStatus
from app.tracking.models import ApplicationHistory, JobApplication
from app.tracking.screenshot_storage import ScreenshotStorage
from app.users.enums import AccountStatus, Role
from app.users.models import User

_TREND_DAYS = 14


def get_overview(db: Session) -> OverviewStatsResponse:
    total_users = db.query(User).filter(User.role == Role.USER).count()
    active_users = db.query(User).filter(User.role == Role.USER, User.status == AccountStatus.ACTIVE).count()
    pending_users = (
        db.query(User).filter(User.role == Role.USER, User.status == AccountStatus.PENDING_APPROVAL).count()
    )
    rejected_users = db.query(User).filter(User.role == Role.USER, User.status == AccountStatus.REJECTED).count()
    total_applications = db.query(JobApplication).count()

    return OverviewStatsResponse(
        totalUsers=total_users,
        activeUsers=active_users,
        pendingUsers=pending_users,
        rejectedUsers=rejected_users,
        totalApplications=total_applications,
    )


def get_application_stats(db: Session, user_id_filter: uuid.UUID | None = None) -> ApplicationStatsResponse:
    """Aggregate (no `user_id_filter`) or single-user (with it) application stats — same shape
    either way, so the manager dashboard's org-wide chart and a single applicant's detail-page
    chart can share one component on the frontend."""
    base_query = db.query(JobApplication)
    if user_id_filter is not None:
        base_query = base_query.filter(JobApplication.user_id == user_id_filter)

    breakdown: dict[ApplicationStatus, int] = {}
    for status_value in ApplicationStatus:
        breakdown[status_value] = base_query.filter(JobApplication.status == status_value).count()

    return ApplicationStatsResponse(statusBreakdown=breakdown, dailyTrend=_build_daily_trend(db, user_id_filter))


def list_users(
    db: Session, status_filter: AccountStatus | None, page: int, size: int
) -> PageResponse[ManagerUserResponse]:
    query = db.query(User).filter(User.role == Role.USER)
    if status_filter is not None:
        query = query.filter(User.status == status_filter)
    query = query.order_by(User.created_at.desc())

    items, total_elements, total_pages, last = paginate(query, page, size)

    counts = _application_counts_for(db, [user.id for user in items])

    return PageResponse(
        items=[_to_response(user, counts.get(user.id, 0)) for user in items],
        page=page,
        size=size,
        totalElements=total_elements,
        totalPages=total_pages,
        last=last,
    )


def get_user(db: Session, user_id: uuid.UUID) -> ManagerUserResponse:
    user = _find_managed_user(db, user_id)
    application_count = db.query(JobApplication).filter(JobApplication.user_id == user_id).count()
    return _to_response(user, application_count)


def approve(db: Session, user_id: uuid.UUID) -> ManagerUserResponse:
    return _update_status(db, user_id, AccountStatus.ACTIVE)


def reject(db: Session, user_id: uuid.UUID) -> ManagerUserResponse:
    return _update_status(db, user_id, AccountStatus.REJECTED)


def list_all_applications(
    db: Session,
    user_id_filter: uuid.UUID | None,
    status_filter: ApplicationStatus | None,
    page: int,
    size: int,
) -> PageResponse[ManagerApplicationResponse]:
    """Cross-user application feed for the manager dashboard - every application from every
    applicant (not just counts), optionally narrowed to one user and/or one status."""
    query = db.query(JobApplication, User).join(User, JobApplication.user_id == User.id)
    if user_id_filter is not None:
        query = query.filter(JobApplication.user_id == user_id_filter)
    if status_filter is not None:
        query = query.filter(JobApplication.status == status_filter)
    query = query.order_by(JobApplication.created_at.desc())

    rows, total_elements, total_pages, last = paginate(query, page, size)

    return PageResponse(
        items=[_to_application_response(application, user) for application, user in rows],
        page=page,
        size=size,
        totalElements=total_elements,
        totalPages=total_pages,
        last=last,
    )


def delete_user(db: Session, user_id: uuid.UUID) -> None:
    """Permanently removes a client-user account. The DB foreign keys (profiles, resumes,
    applications -> application_history) all cascade on delete, so removing the `users` row is
    enough to wipe everything - the only thing that doesn't cascade automatically is the actual
    resume files sitting in S3/MinIO, which are cleaned up here first on a best-effort basis."""
    user = _find_managed_user(db, user_id)

    resume_storage = ResumeStorage()
    resumes = db.query(Resume).filter(Resume.user_id == user_id).all()
    for resume in resumes:
        resume_storage.delete(resume_storage.extract_key(resume.file_url))

    screenshot_storage = ScreenshotStorage()
    applications = db.query(JobApplication).filter(JobApplication.user_id == user_id).all()
    for application in applications:
        if application.screenshot_url:
            screenshot_storage.delete(screenshot_storage.extract_key(application.screenshot_url))

    db.delete(user)
    db.commit()


def update_application_status(
    db: Session, application_id: uuid.UUID, new_status: ApplicationStatus
) -> ManagerApplicationResponse:
    """Lets a manager correct/advance an applicant's pipeline stage (e.g. APPLIED -> INTERVIEW)
    on their behalf - same history-writing behaviour as the applicant's own PATCH
    /applications/{id}/status, just without the ownership check since the manager isn't the
    application's owner."""
    application = (
        db.query(JobApplication, User)
        .join(User, JobApplication.user_id == User.id)
        .filter(JobApplication.id == application_id)
        .first()
    )
    if application is None:
        raise ResourceNotFoundException("Application not found")

    job_application, user = application
    old_status = job_application.status

    if old_status != new_status:
        job_application.status = new_status
        db.add(ApplicationHistory(application_id=job_application.id, old_status=old_status, new_status=new_status))
        db.commit()
        db.refresh(job_application)

    return _to_application_response(job_application, user)


def delete_application(db: Session, application_id: uuid.UUID) -> None:
    """Permanently removes a single tracked application - and, via the DB's ondelete=CASCADE FK,
    its application_history rows - without touching the owning user account. Used by the manager
    to clean up bad/duplicate/test entries (e.g. mis-fires from the extension's auto-detection)."""
    application = db.query(JobApplication).filter(JobApplication.id == application_id).first()
    if application is None:
        raise ResourceNotFoundException("Application not found")

    if application.screenshot_url:
        screenshot_storage = ScreenshotStorage()
        screenshot_storage.delete(screenshot_storage.extract_key(application.screenshot_url))

    db.delete(application)
    db.commit()


def _update_status(db: Session, user_id: uuid.UUID, new_status: AccountStatus) -> ManagerUserResponse:
    user = _find_managed_user(db, user_id)
    user.status = new_status
    db.commit()
    db.refresh(user)

    application_count = db.query(JobApplication).filter(JobApplication.user_id == user_id).count()
    return _to_response(user, application_count)


def _find_managed_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.query(User).filter(User.id == user_id, User.role == Role.USER).first()
    if user is None:
        raise ResourceNotFoundException("User not found")
    return user


def _application_counts_for(db: Session, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not user_ids:
        return {}
    rows = (
        db.query(JobApplication.user_id, func.count(JobApplication.id))
        .filter(JobApplication.user_id.in_(user_ids))
        .group_by(JobApplication.user_id)
        .all()
    )
    return dict(rows)


def _build_daily_trend(db: Session, user_id_filter: uuid.UUID | None = None) -> list[DailyApplicationCount]:
    since = date.today() - timedelta(days=_TREND_DAYS - 1)
    query = db.query(JobApplication.applied_date, func.count(JobApplication.id)).filter(
        JobApplication.applied_date >= since
    )
    if user_id_filter is not None:
        query = query.filter(JobApplication.user_id == user_id_filter)
    rows = query.group_by(JobApplication.applied_date).all()
    counts_by_date = dict(rows)

    trend: list[DailyApplicationCount] = []
    current = since
    today = date.today()
    while current <= today:
        trend.append(DailyApplicationCount(date=current, count=counts_by_date.get(current, 0)))
        current += timedelta(days=1)
    return trend


def _to_application_response(application: JobApplication, user: User) -> ManagerApplicationResponse:
    return ManagerApplicationResponse(
        id=application.id,
        userId=user.id,
        userEmail=user.email,
        company=application.company,
        jobTitle=application.job_title,
        jobUrl=application.job_url,
        status=application.status,
        appliedDate=application.applied_date,
        screenshotUrl=application.screenshot_url,
        createdAt=application.created_at,
        updatedAt=application.updated_at,
    )


def _to_response(user: User, application_count: int) -> ManagerUserResponse:
    return ManagerUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        status=user.status,
        createdAt=user.created_at,
        applicationCount=application_count,
    )
