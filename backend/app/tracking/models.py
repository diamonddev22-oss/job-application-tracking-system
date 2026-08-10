import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow
from app.tracking.enums import ApplicationStatus

_STATUS_TYPE = Enum(ApplicationStatus, name="application_status", native_enum=False, length=20)


class JobApplication(Base):
    """The core tracked entity: one manually- or extension-submitted job application."""

    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("user_id", "job_url", name="uq_applications_user_job_url"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    job_title: Mapped[str] = mapped_column(String(255), nullable=False)
    job_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    status: Mapped[ApplicationStatus] = mapped_column(_STATUS_TYPE, nullable=False)
    applied_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Populated by the Chrome extension's auto-detection engine: a viewport screenshot of the
    # confirmation page/state, captured at the moment a submission was detected, as visual proof of
    # the application alongside the company/title/URL fields above. Nullable because it's
    # best-effort (capture or upload can fail without blocking the tracked application itself) and
    # because manually-logged applications never have one.
    screenshot_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow, onupdate=utcnow)


class ApplicationHistory(Base):
    """Append-only audit trail of status transitions, written explicitly by the tracking service."""

    __tablename__ = "application_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=False
    )
    old_status: Mapped[ApplicationStatus | None] = mapped_column(_STATUS_TYPE, nullable=True)
    new_status: Mapped[ApplicationStatus] = mapped_column(_STATUS_TYPE, nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=utcnow)
