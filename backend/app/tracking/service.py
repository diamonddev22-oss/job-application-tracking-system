import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.common.pagination import paginate
from app.common.schemas import PageResponse
from app.core.database import utcnow
from app.core.exceptions import AccessDeniedException, AccountNotActiveException, ResourceNotFoundException
from app.tracking.enums import ApplicationStatus
from app.tracking.models import ApplicationHistory, JobApplication
from app.tracking.schemas import (
    ApplicationEventRequest,
    ApplicationEventResponse,
    ApplicationHistoryResponse,
    JobApplicationResponse,
    ScreenshotUploadUrlRequest,
    ScreenshotUploadUrlResponse,
)
from app.tracking.screenshot_storage import ScreenshotStorage
from app.users.enums import AccountStatus
from app.users.models import User

_screenshot_storage = ScreenshotStorage()


def create_screenshot_upload_url(user_id: uuid.UUID, request: ScreenshotUploadUrlRequest) -> ScreenshotUploadUrlResponse:
    key = _screenshot_storage.build_key(user_id, request.contentType)
    upload_url = _screenshot_storage.presign_upload(key, request.contentType)
    expires_at = datetime.now(timezone.utc) + _screenshot_storage.upload_url_ttl()
    return ScreenshotUploadUrlResponse(uploadUrl=upload_url, key=key, expiresAt=expires_at)

# The Chrome extension's auto-detection runs several independent signals in parallel (URL pattern,
# on-page text, network requests — see the extension's background.ts header comment) that can each
# notice the *same* real-world submission and report it separately, sometimes with a slightly
# different job_url (an SPA router appending a query param, a confirmation redirect landing on a
# marginally different path than the original listing, etc.). The extension has its own short-lived
# client-side cooldown for this, but that can't cover every case (a different tab/session, an
# extension restart between the two reports, ...), so this is the authoritative, permanent guard:
# exact job_url is still checked first (and is still what the DB's unique constraint enforces below,
# for the near-simultaneous-request race), but a same-user submission with the same company AND job
# title within this window is *also* treated as the same application, regardless of job_url.
NEAR_DUPLICATE_WINDOW = timedelta(minutes=10)


def record_event(db: Session, user: User, request: ApplicationEventRequest) -> ApplicationEventResponse:
    if user.status != AccountStatus.ACTIVE:
        raise AccountNotActiveException(
            "Your account is pending manager approval and cannot track applications yet"
        )

    already_exists = (
        db.query(JobApplication)
        .filter(JobApplication.user_id == user.id, JobApplication.job_url == request.jobUrl)
        .first()
        is not None
    )
    if already_exists:
        return ApplicationEventResponse.duplicate()

    near_duplicate_cutoff = utcnow() - NEAR_DUPLICATE_WINDOW
    near_duplicate = (
        db.query(JobApplication)
        .filter(
            JobApplication.user_id == user.id,
            JobApplication.company == request.company,
            JobApplication.job_title == request.jobTitle,
            JobApplication.created_at >= near_duplicate_cutoff,
        )
        .first()
    )
    if near_duplicate is not None:
        return ApplicationEventResponse.duplicate()

    screenshot_url = None
    if request.screenshotKey is not None:
        expected_prefix = f"screenshots/{user.id}/"
        if not request.screenshotKey.startswith(expected_prefix):
            raise AccessDeniedException("Invalid screenshot key")
        screenshot_url = _screenshot_storage.public_url(request.screenshotKey)

    application = JobApplication(
        user_id=user.id,
        company=request.company,
        job_title=request.jobTitle,
        job_url=request.jobUrl,
        status=ApplicationStatus.APPLIED,
        applied_date=request.timestamp.astimezone(timezone.utc).date(),
        screenshot_url=screenshot_url,
    )
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        # Two near-simultaneous submissions for the same job — the unique constraint caught it.
        db.rollback()
        return ApplicationEventResponse.duplicate()

    db.refresh(application)
    db.add(ApplicationHistory(application_id=application.id, old_status=None, new_status=ApplicationStatus.APPLIED))
    db.commit()

    return ApplicationEventResponse.success()


def list_applications(
    db: Session, user_id: uuid.UUID, status_filter: ApplicationStatus | None, page: int, size: int
) -> PageResponse[JobApplicationResponse]:
    query = db.query(JobApplication).filter(JobApplication.user_id == user_id)
    if status_filter is not None:
        query = query.filter(JobApplication.status == status_filter)
    query = query.order_by(JobApplication.created_at.desc())

    items, total_elements, total_pages, last = paginate(query, page, size)
    return PageResponse(
        items=[_to_response(item) for item in items],
        page=page,
        size=size,
        totalElements=total_elements,
        totalPages=total_pages,
        last=last,
    )


def get_application(db: Session, user_id: uuid.UUID, application_id: uuid.UUID) -> JobApplicationResponse:
    return _to_response(_find_owned(db, user_id, application_id))


def update_status(
    db: Session, user_id: uuid.UUID, application_id: uuid.UUID, new_status: ApplicationStatus
) -> JobApplicationResponse:
    application = _find_owned(db, user_id, application_id)
    old_status = application.status

    if old_status != new_status:
        application.status = new_status
        db.add(ApplicationHistory(application_id=application.id, old_status=old_status, new_status=new_status))
        db.commit()
        db.refresh(application)

    return _to_response(application)


def get_history(db: Session, user_id: uuid.UUID, application_id: uuid.UUID) -> list[ApplicationHistoryResponse]:
    _find_owned(db, user_id, application_id)
    history = (
        db.query(ApplicationHistory)
        .filter(ApplicationHistory.application_id == application_id)
        .order_by(ApplicationHistory.changed_at.desc())
        .all()
    )
    return [_to_history_response(entry) for entry in history]


def _find_owned(db: Session, user_id: uuid.UUID, application_id: uuid.UUID) -> JobApplication:
    application = (
        db.query(JobApplication)
        .filter(JobApplication.id == application_id, JobApplication.user_id == user_id)
        .first()
    )
    if application is None:
        raise ResourceNotFoundException("Application not found")
    return application


def _to_response(app: JobApplication) -> JobApplicationResponse:
    return JobApplicationResponse(
        id=app.id,
        company=app.company,
        jobTitle=app.job_title,
        jobUrl=app.job_url,
        status=app.status,
        appliedDate=app.applied_date,
        screenshotUrl=app.screenshot_url,
        createdAt=app.created_at,
        updatedAt=app.updated_at,
    )


def _to_history_response(history: ApplicationHistory) -> ApplicationHistoryResponse:
    return ApplicationHistoryResponse(
        id=history.id, oldStatus=history.old_status, newStatus=history.new_status, changedAt=history.changed_at
    )
