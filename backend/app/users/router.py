from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.common.schemas import ApiResponse
from app.core.database import get_db
from app.core.security import get_current_user
from app.users import service
from app.users.models import User
from app.users.schemas import ProfileResponse, ProfileUpdateRequest, UserSummaryResponse

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=ApiResponse[UserSummaryResponse])
def me(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ApiResponse[UserSummaryResponse]:
    return ApiResponse.of(service.get_summary(db, current_user.id))


@router.get("/me/profile", response_model=ApiResponse[ProfileResponse])
def get_profile(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ApiResponse[ProfileResponse]:
    return ApiResponse.of(service.get_profile(db, current_user.id))


@router.put("/me/profile", response_model=ApiResponse[ProfileResponse])
def update_profile(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[ProfileResponse]:
    return ApiResponse.of(service.update_profile(db, current_user.id, request), "Profile updated")
