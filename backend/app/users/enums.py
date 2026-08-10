import enum


class Role(str, enum.Enum):
    USER = "USER"
    MANAGER = "MANAGER"


class AccountStatus(str, enum.Enum):
    """Self-registered accounts start as PENDING_APPROVAL. A MANAGER must approve (ACTIVE) or
    REJECTED before the user can submit application events. Profile and resume management remain
    available regardless of status."""

    PENDING_APPROVAL = "PENDING_APPROVAL"
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"
