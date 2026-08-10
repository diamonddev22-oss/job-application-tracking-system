from datetime import datetime, timezone

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.exceptions import (
    AccessDeniedException,
    AccountDisabledException,
    AccountNotActiveException,
    DuplicateResourceException,
    InvalidCredentialsException,
    NotAuthenticatedException,
    ResourceNotFoundException,
)

_REASON_PHRASES = {
    status.HTTP_400_BAD_REQUEST: "Bad Request",
    status.HTTP_401_UNAUTHORIZED: "Unauthorized",
    status.HTTP_403_FORBIDDEN: "Forbidden",
    status.HTTP_404_NOT_FOUND: "Not Found",
    status.HTTP_409_CONFLICT: "Conflict",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "Internal Server Error",
}


def _error_body(status_code: int, message: str, field_errors: dict[str, str] | None = None) -> dict:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status_code,
        "error": _REASON_PHRASES.get(status_code, "Error"),
        "message": message,
        "fieldErrors": field_errors,
    }


def _build(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=_error_body(status_code, message))


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ResourceNotFoundException)
    async def handle_not_found(_request: Request, exc: ResourceNotFoundException) -> JSONResponse:
        return _build(status.HTTP_404_NOT_FOUND, exc.message)

    @app.exception_handler(DuplicateResourceException)
    async def handle_duplicate(_request: Request, exc: DuplicateResourceException) -> JSONResponse:
        return _build(status.HTTP_409_CONFLICT, exc.message)

    @app.exception_handler(AccountNotActiveException)
    async def handle_account_not_active(_request: Request, exc: AccountNotActiveException) -> JSONResponse:
        return _build(status.HTTP_403_FORBIDDEN, exc.message)

    @app.exception_handler(InvalidCredentialsException)
    async def handle_invalid_credentials(_request: Request, exc: InvalidCredentialsException) -> JSONResponse:
        return _build(status.HTTP_401_UNAUTHORIZED, exc.message)

    @app.exception_handler(AccountDisabledException)
    async def handle_account_disabled(_request: Request, exc: AccountDisabledException) -> JSONResponse:
        return _build(status.HTTP_403_FORBIDDEN, exc.message)

    @app.exception_handler(NotAuthenticatedException)
    async def handle_not_authenticated(_request: Request, exc: NotAuthenticatedException) -> JSONResponse:
        return _build(status.HTTP_401_UNAUTHORIZED, exc.message)

    @app.exception_handler(AccessDeniedException)
    async def handle_access_denied(_request: Request, exc: AccessDeniedException) -> JSONResponse:
        return _build(status.HTTP_403_FORBIDDEN, exc.message)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(_request: Request, exc: RequestValidationError) -> JSONResponse:
        field_errors: dict[str, str] = {}
        for error in exc.errors():
            # loc looks like ('body', 'email') or ('query', 'status') — the field name is the last part.
            field = str(error["loc"][-1])
            field_errors[field] = error["msg"]
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=_error_body(status.HTTP_400_BAD_REQUEST, "Validation failed", field_errors),
        )

    @app.exception_handler(Exception)
    async def handle_generic(_request: Request, _exc: Exception) -> JSONResponse:
        return _build(status.HTTP_500_INTERNAL_SERVER_ERROR, "An unexpected error occurred")
