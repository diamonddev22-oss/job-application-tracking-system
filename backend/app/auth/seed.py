import logging

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.users.enums import AccountStatus, Role
from app.users.models import User

logger = logging.getLogger(__name__)


def seed_manager_account(db: Session) -> None:
    """Ensures at least one MANAGER account exists so there is always someone able to approve new
    users and access the manager dashboard. Managers are never self-registered."""
    if db.query(User).filter(User.role == Role.MANAGER).first() is not None:
        return

    settings = get_settings()
    manager = User(
        email=settings.manager_default_email,
        password_hash=hash_password(settings.manager_default_password),
        role=Role.MANAGER,
        status=AccountStatus.ACTIVE,
        is_enabled=True,
    )
    db.add(manager)
    db.commit()
    logger.info("No manager account found - seeded default manager account '%s'", settings.manager_default_email)
