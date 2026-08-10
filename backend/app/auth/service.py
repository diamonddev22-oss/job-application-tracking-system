from sqlalchemy.orm import Session

from app.auth.schemas import AuthResponse, LoginRequest, RegisterRequest
from app.core.exceptions import AccountDisabledException, DuplicateResourceException, InvalidCredentialsException
from app.core.security import create_access_token, hash_password, verify_password
from app.users.enums import AccountStatus, Role
from app.users.models import Profile, User


def register(db: Session, request: RegisterRequest) -> AuthResponse:
    if db.query(User).filter(User.email == request.email).first() is not None:
        raise DuplicateResourceException("An account with this email already exists")

    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        role=Role.USER,
        status=AccountStatus.PENDING_APPROVAL,
        is_enabled=True,
    )
    db.add(user)
    db.flush()  # populate user.id before creating the profile row

    db.add(Profile(user_id=user.id))
    db.commit()
    db.refresh(user)

    return _build_auth_response(user)


def login(db: Session, request: LoginRequest) -> AuthResponse:
    user = db.query(User).filter(User.email == request.email).first()
    if user is None or not verify_password(request.password, user.password_hash):
        raise InvalidCredentialsException()
    if not user.is_enabled:
        raise AccountDisabledException()

    return _build_auth_response(user)


def _build_auth_response(user: User) -> AuthResponse:
    token = create_access_token(user)
    return AuthResponse(token=token, id=user.id, email=user.email, role=user.role, status=user.status)
