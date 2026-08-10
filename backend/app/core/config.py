from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> parents[3] is the workspace root, where the shared .env lives
# (the same file docker-compose reads). Falls back to field defaults below if it doesn't exist.
_ROOT_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ROOT_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "jats"
    db_user: str = "jats"
    db_password: str = "jats_dev_password"

    # Set this in production (e.g. Render, pointed at Neon) to a full connection string instead of
    # the discrete db_* fields above, which exist for local dev only (docker-compose/native Postgres
    # has no single connection string to copy-paste). Takes priority over db_* when set; see
    # `sqlalchemy_database_url` below for the scheme normalization this needs. Left unset locally so
    # existing local dev behavior is completely unaffected.
    database_url: str | None = None

    jwt_secret: str = "change-this-secret-in-production-min-32-chars"
    jwt_expiration_ms: int = 86_400_000

    s3_endpoint: str = "http://localhost:9000"
    s3_public_endpoint: str = "http://localhost:9000"
    # Overrides how public_url()/extract_key() (ResumeStorage, ScreenshotStorage) build the
    # permanent, browser-facing link for an object, when that's a *different* host+path than the
    # one used to talk to the S3 API. Needed for Cloudflare R2 in production: its S3 API endpoint
    # (s3_endpoint/s3_public_endpoint, `https://<account_id>.r2.cloudflarestorage.com`) requires
    # authentication for GET, so public read access is only served from a separate public bucket
    # URL (an "r2.dev" subdomain or a custom domain) with no bucket segment in the path. Left unset
    # for local MinIO, which serves public GETs directly from s3_public_endpoint like before.
    s3_public_url: str | None = None
    s3_access_key: str = "jats_minio"
    s3_secret_key: str = "jats_minio_password"
    s3_bucket: str = "resumes"
    s3_region: str = "us-east-1"

    # Both host forms are listed because some VPNs (e.g. Astrill) break IPv6, which makes
    # "localhost" unreachable and forces browsers/dev servers onto 127.0.0.1 instead.
    cors_allowed_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    )

    # Lets a browser on a *different* machine on the same LAN (e.g. a teammate testing against this
    # PC's dev servers) load the frontend and call this API - the frontend's dev server (and this
    # API) need to be started bound to 0.0.0.0 for that to even be reachable in the first place, see
    # frontend/vite.config.ts and README.md. A regex (rather than one more entry in
    # cors_allowed_origins) is used because the LAN IP is whatever DHCP hands out and isn't known
    # ahead of time; scoped to the well-known private-IP ranges (RFC 1918) and the two dev ports
    # above, so it's not "allow literally anything".
    cors_allowed_origin_regex: str = (
        r"^https?://(192\.168\.\d{1,3}\.\d{1,3}"
        r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):517[34]$"
    )

    manager_default_email: str = "manager@jats.local"
    manager_default_password: str = "ChangeMe123!"

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            url = self.database_url
            # Neon (and most managed Postgres providers) hand out `postgres://` or
            # `postgresql://` connection strings - normalize to the psycopg3 driver this project
            # actually has installed (see requirements.txt; there's no psycopg2 here for
            # SQLAlchemy to fall back to). Query params (e.g. Neon's `?sslmode=require`) are part
            # of the unchanged remainder, so SSL keeps working exactly as Neon's copy-pasted string
            # intends.
            for prefix in ("postgresql://", "postgres://"):
                if url.startswith(prefix):
                    return "postgresql+psycopg://" + url[len(prefix) :]
            return url
        return f"postgresql+psycopg://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
