import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.common.schemas import ApiResponse
from app.core.database import get_db
from app.core.security import get_current_user
from app.resumes import service
from app.resumes.schemas import RegisterResumeRequest, ResumeResponse, UploadUrlRequest, UploadUrlResponse
from app.users.models import User

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


@router.post("/upload-url", response_model=ApiResponse[UploadUrlResponse])
def create_upload_url(
    request: UploadUrlRequest, current_user: User = Depends(get_current_user)
) -> ApiResponse[UploadUrlResponse]:
    return ApiResponse.of(service.create_upload_url(current_user.id, request))


@router.post("", response_model=ApiResponse[ResumeResponse], status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterResumeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApiResponse[ResumeResponse]:
    return ApiResponse.of(service.register(db, current_user.id, request), "Resume registered")


@router.get("", response_model=ApiResponse[list[ResumeResponse]])
def list_resumes(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ApiResponse[list[ResumeResponse]]:
    return ApiResponse.of(service.list_resumes(db, current_user.id))


@router.get("/{resume_id}", response_model=ApiResponse[ResumeResponse])
def get(
    resume_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ApiResponse[ResumeResponse]:
    return ApiResponse.of(service.get(db, current_user.id, resume_id))


@router.delete("/{resume_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(
    resume_id: uuid.UUID, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Response:
    service.delete(db, current_user.id, resume_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
