import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.tracking.enums import ApplicationStatus
from app.users.enums import AccountStatus, Role


class OverviewStatsResponse(BaseModel):
    """Top-line counts for GET /manager/stats/overview. All user counts exclude MANAGER accounts."""

    totalUsers: int
    activeUsers: int
    pendingUsers: int
    rejectedUsers: int
    totalApplications: int


class DailyApplicationCount(BaseModel):
    """One point in the trend chart. Days with no applications are included with count = 0."""

    date: date
    count: int


class ApplicationStatsResponse(BaseModel):
    statusBreakdown: dict[ApplicationStatus, int]
    dailyTrend: list[DailyApplicationCount]


class ManagerUserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: Role
    status: AccountStatus
    createdAt: datetime
    applicationCount: int


class ManagerApplicationResponse(BaseModel):
    """A single tracked application, as seen from the manager's cross-user view."""

    id: uuid.UUID
    userId: uuid.UUID
    userEmail: str
    company: str
    jobTitle: str
    jobUrl: str
    status: ApplicationStatus
    appliedDate: date
    screenshotUrl: str | None
    createdAt: datetime
    updatedAt: datetime
