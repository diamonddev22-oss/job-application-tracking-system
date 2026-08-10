import uuid

from sqlalchemy.orm import Session

from app.core.exceptions import ResourceNotFoundException
from app.users.models import Profile, User
from app.users.schemas import ProfileResponse, ProfileUpdateRequest, UserSummaryResponse


def get_summary(db: Session, user_id: uuid.UUID) -> UserSummaryResponse:
    user = db.get(User, user_id)
    if user is None:
        raise ResourceNotFoundException("User not found")
    return UserSummaryResponse(
        id=user.id, email=user.email, role=user.role, status=user.status, createdAt=user.created_at
    )


def get_profile(db: Session, user_id: uuid.UUID) -> ProfileResponse:
    return _to_response(_get_or_create(db, user_id))


def update_profile(db: Session, user_id: uuid.UUID, request: ProfileUpdateRequest) -> ProfileResponse:
    profile = _get_or_create(db, user_id)
    profile.name = request.name
    profile.location = request.location
    profile.skills = request.skills
    profile.experience = request.experience
    db.commit()
    db.refresh(profile)
    return _to_response(profile)


def _get_or_create(db: Session, user_id: uuid.UUID) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user_id).first()
    if profile is None:
        profile = Profile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def _to_response(profile: Profile) -> ProfileResponse:
    return ProfileResponse(
        name=profile.name,
        location=profile.location,
        skills=profile.skills,
        experience=profile.experience,
        updatedAt=profile.updated_at,
    )
