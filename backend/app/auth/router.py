from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.auth import service
from app.auth.schemas import AuthResponse, LoginRequest, RegisterRequest
from app.common.schemas import ApiResponse
from app.core.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=ApiResponse[AuthResponse], status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)) -> ApiResponse[AuthResponse]:
    response = service.register(db, request)
    return ApiResponse.of(
        response, "Account created. A manager must approve it before you can track applications."
    )


@router.post("/login", response_model=ApiResponse[AuthResponse])
def login(request: LoginRequest, db: Session = Depends(get_db)) -> ApiResponse[AuthResponse]:
    return ApiResponse.of(service.login(db, request), "Login successful")
