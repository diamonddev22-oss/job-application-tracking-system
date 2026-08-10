from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.exceptions import AccessDeniedException, NotAuthenticatedException
from app.users.enums import Role
from app.users.models import User

_JWT_ALGORITHM = "HS256"
_BEARER_PREFIX = "Bearer "


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user: User) -> str:
    """Issues a stateless HS256 JWT with the same claim names the frontend/extension never see
    directly but which used to be produced by the Java JwtService (sub/userId/role)."""
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user.email,
        "userId": str(user.id),
        "role": user.role.value,
        "iat": now,
        "exp": now + timedelta(milliseconds=settings.jwt_expiration_ms),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=_JWT_ALGORITHM)


def get_current_user(authorization: str | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith(_BEARER_PREFIX):
        raise NotAuthenticatedException()

    token = authorization[len(_BEARER_PREFIX) :]
    try:
        payload = jwt.decode(token, get_settings().jwt_secret, algorithms=[_JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise NotAuthenticatedException()

    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        # Token was valid but the account no longer exists.
        raise NotAuthenticatedException()
    return user


def require_manager(user: User = Depends(get_current_user)) -> User:
    if user.role != Role.MANAGER:
        raise AccessDeniedException()
    return user
