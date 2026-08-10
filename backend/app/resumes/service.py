import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.exceptions import AccessDeniedException, ResourceNotFoundException
from app.resumes.models import Resume
from app.resumes.schemas import RegisterResumeRequest, ResumeResponse, UploadUrlRequest, UploadUrlResponse
from app.resumes.storage import ResumeStorage

_storage = ResumeStorage()


def create_upload_url(user_id: uuid.UUID, request: UploadUrlRequest) -> UploadUrlResponse:
    key = _storage.build_key(user_id, request.fileName)
    upload_url = _storage.presign_upload(key, request.contentType)
    file_url = _storage.public_url(key)
    expires_at = datetime.now(timezone.utc) + _storage.upload_url_ttl()
    return UploadUrlResponse(uploadUrl=upload_url, key=key, fileUrl=file_url, expiresAt=expires_at)


def register(db: Session, user_id: uuid.UUID, request: RegisterResumeRequest) -> ResumeResponse:
    expected_prefix = f"resumes/{user_id}/"
    if not request.key.startswith(expected_prefix):
        raise AccessDeniedException("Invalid resume key")

    next_version = db.query(Resume).filter(Resume.user_id == user_id).count() + 1
    resume = Resume(user_id=user_id, file_url=_storage.public_url(request.key), version=next_version)
    db.add(resume)
    db.commit()
    db.refresh(resume)
    return _to_response(resume)


def list_resumes(db: Session, user_id: uuid.UUID) -> list[ResumeResponse]:
    resumes = db.query(Resume).filter(Resume.user_id == user_id).order_by(Resume.version.desc()).all()
    return [_to_response(resume) for resume in resumes]


def get(db: Session, user_id: uuid.UUID, resume_id: uuid.UUID) -> ResumeResponse:
    return _to_response(_find_owned(db, user_id, resume_id))


def delete(db: Session, user_id: uuid.UUID, resume_id: uuid.UUID) -> None:
    resume = _find_owned(db, user_id, resume_id)
    db.delete(resume)
    db.commit()
    _storage.delete(_storage.extract_key(resume.file_url))


def _find_owned(db: Session, user_id: uuid.UUID, resume_id: uuid.UUID) -> Resume:
    resume = db.query(Resume).filter(Resume.id == resume_id, Resume.user_id == user_id).first()
    if resume is None:
        raise ResourceNotFoundException("Resume not found")
    return resume


def _to_response(resume: Resume) -> ResumeResponse:
    return ResumeResponse(
        id=resume.id, fileUrl=resume.file_url, version=resume.version, createdAt=resume.created_at
    )
