import logging
import uuid
from datetime import timedelta

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_UPLOAD_URL_TTL = timedelta(minutes=5)

_EXTENSION_BY_CONTENT_TYPE = {"image/png": "png", "image/jpeg": "jpg"}


class ScreenshotStorage:
    """Same shape as app.resumes.storage.ResumeStorage (two S3 clients, presigned PUT for the
    browser, path-style addressing for MinIO) but under its own "screenshots/" key prefix — kept as
    a separate, small class rather than generalizing the two into one shared base, since resumes and
    screenshots have different owners (a resume belongs to the user's profile; a screenshot belongs
    to one specific tracked application) and this is the only thing they'd actually share.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self._bucket = settings.s3_bucket
        # See Settings.s3_public_url: unset locally (MinIO serves public GETs straight from its
        # own S3 API endpoint+bucket), set in production to R2's separate public-bucket URL, which
        # already has the bucket baked into the domain/custom-domain and so takes no bucket segment.
        self._public_url_base = (
            settings.s3_public_url.rstrip("/")
            if settings.s3_public_url
            else f"{settings.s3_public_endpoint.rstrip('/')}/{self._bucket}"
        )

        client_config = Config(signature_version="s3v4", s3={"addressing_style": "path"})
        credentials = {
            "aws_access_key_id": settings.s3_access_key,
            "aws_secret_access_key": settings.s3_secret_key,
            "region_name": settings.s3_region,
            "config": client_config,
        }

        self._client = boto3.client("s3", endpoint_url=settings.s3_endpoint, **credentials)
        self._presign_client = boto3.client("s3", endpoint_url=settings.s3_public_endpoint, **credentials)

    def build_key(self, user_id: uuid.UUID, content_type: str) -> str:
        extension = _EXTENSION_BY_CONTENT_TYPE[content_type]
        return f"screenshots/{user_id}/{uuid.uuid4()}.{extension}"

    def upload_url_ttl(self) -> timedelta:
        return _UPLOAD_URL_TTL

    def presign_upload(self, key: str, content_type: str) -> str:
        return self._presign_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self._bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=int(_UPLOAD_URL_TTL.total_seconds()),
        )

    def public_url(self, key: str) -> str:
        return f"{self._public_url_base}/{key}"

    def extract_key(self, file_url: str) -> str:
        prefix = self.public_url("")
        return file_url[len(prefix) :] if file_url.startswith(prefix) else file_url

    def delete(self, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
        except (BotoCoreError, ClientError) as exc:
            logger.warning("Failed to delete S3 object '%s': %s", key, exc)
