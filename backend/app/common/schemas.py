from datetime import datetime
from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """Standard success envelope every endpoint wraps its payload in (except application-events)."""

    success: bool = True
    message: Optional[str] = None
    data: Optional[T] = None

    @classmethod
    def of(cls, data: T, message: Optional[str] = None) -> "ApiResponse[T]":
        return cls(success=True, message=message, data=data)


class PageResponse(BaseModel, Generic[T]):
    """Flattened pagination envelope so clients don't need to parse a raw SQL page shape."""

    items: list[T]
    page: int
    size: int
    totalElements: int
    totalPages: int
    last: bool


class ErrorResponse(BaseModel):
    timestamp: datetime
    status: int
    error: str
    message: str
    fieldErrors: Optional[dict[str, str]] = None
