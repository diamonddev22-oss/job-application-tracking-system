import enum


class ApplicationStatus(str, enum.Enum):
    APPLIED = "APPLIED"
    SCREENING = "SCREENING"
    INTERVIEW = "INTERVIEW"
    OFFER = "OFFER"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"


class EventType(str, enum.Enum):
    APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED"


class ApplicationEventStatus(str, enum.Enum):
    """Outcome of a POST /application-events call - mirrors the Chrome extension's contract."""

    SUCCESS = "SUCCESS"
    DUPLICATE = "DUPLICATE"
