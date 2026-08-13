"""Domain exceptions mapped to HTTP responses by app.core.exception_handlers."""


class ResourceNotFoundException(Exception):
    def __init__(self, message: str = "Resource not found"):
        self.message = message


class DuplicateResourceException(Exception):
    def __init__(self, message: str = "Resource already exists"):
        self.message = message


class AccountNotActiveException(Exception):
    """A PENDING_APPROVAL or REJECTED account attempted an action that requires ACTIVE status."""

    def __init__(self, message: str = "Your account is not active"):
        self.message = message


class InvalidCredentialsException(Exception):
    def __init__(self, message: str = "Invalid email or password"):
        self.message = message


class AccountDisabledException(Exception):
    def __init__(self, message: str = "This account has been disabled"):
        self.message = message


class NotAuthenticatedException(Exception):
    def __init__(self, message: str = "Authentication required"):
        self.message = message


class AccessDeniedException(Exception):
    def __init__(self, message: str = "You do not have permission to perform this action"):
        self.message = message


class InvalidStateException(Exception):
    """The request is well-formed, but the action can't be performed given the current state of
    the resource (e.g. approving an applicant who has no resume on file yet) — distinct from
    RequestValidationError, which is about malformed input, not resource state."""

    def __init__(self, message: str = "This action cannot be performed right now"):
        self.message = message
