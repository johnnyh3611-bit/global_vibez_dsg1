"""
Comprehensive Error Handling & Logging
Improves debugging and user experience
"""
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
import traceback
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/global_vibez_api.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("global_vibez")

class ErrorResponse:
    """Standardized error response format"""
    
    @staticmethod
    def create(
        error_code: str,
        message: str,
        details: dict = None,
        status_code: int = 400
    ):
        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "error": {
                    "code": error_code,
                    "message": message,
                    "details": details or {},
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            }
        )

async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for all unhandled errors.
    Logs errors and returns user-friendly messages.
    """
    # Log the error
    logger.error(
        f"Unhandled exception: {str(exc)}\n"
        f"Path: {request.url.path}\n"
        f"Method: {request.method}\n"
        f"Traceback: {traceback.format_exc()}"
    )
    
    # Don't expose internal errors to users
    if isinstance(exc, HTTPException):
        return ErrorResponse.create(
            error_code="HTTP_ERROR",
            message=exc.detail,
            status_code=exc.status_code
        )
    
    # Generic error for unexpected exceptions
    return ErrorResponse.create(
        error_code="INTERNAL_ERROR",
        message="An unexpected error occurred. Please try again later.",
        details={"request_id": str(datetime.now(timezone.utc).timestamp())},
        status_code=500
    )

# Custom Exception Classes
class ValidationError(HTTPException):
    """Raised when input validation fails"""
    def __init__(self, message: str, details: dict = None):
        super().__init__(
            status_code=400,
            detail={"message": message, "details": details or {}}
        )

class AuthenticationError(HTTPException):
    """Raised when authentication fails"""
    def __init__(self, message: str = "Authentication required"):
        super().__init__(status_code=401, detail=message)

class AuthorizationError(HTTPException):
    """Raised when user lacks permissions"""
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(status_code=403, detail=message)

class ResourceNotFoundError(HTTPException):
    """Raised when resource doesn't exist"""
    def __init__(self, resource: str, identifier: str):
        super().__init__(
            status_code=404,
            detail=f"{resource} '{identifier}' not found"
        )

class BusinessLogicError(HTTPException):
    """Raised when business rules are violated"""
    def __init__(self, message: str):
        super().__init__(status_code=422, detail=message)

def _redact_id(value):
    """Short fingerprint for logs — never write full user IDs or tokens to stdout."""
    if not value:
        return "anonymous"
    text = str(value)
    if len(text) <= 4:
        return "***"
    return f"{text[:2]}…{text[-2:]}"


# Logging helpers
def log_api_call(endpoint: str, user_id: str = None, duration_ms: float = None):
    """Log API calls for monitoring (user id redacted)."""
    duration = f"{duration_ms:.2f}ms" if duration_ms is not None else "n/a"
    logger.info(
        "API Call: %s | User: %s | Duration: %s",
        endpoint,
        _redact_id(user_id),
        duration,
    )

def log_security_event(event_type: str, details: dict):
    """Log security-related events (strip token-like keys)."""
    safe = {
        k: ("***" if any(s in k.lower() for s in ("token", "password", "secret", "authorization")) else v)
        for k, v in (details or {}).items()
    }
    logger.warning("Security Event: %s | Details: %s", event_type, safe)

def log_transaction(transaction_type: str, user_id: str, amount: float, status: str):
    """Log financial transactions (user id redacted)."""
    logger.info(
        "Transaction: %s | User: %s | Amount: %.2f | Status: %s",
        transaction_type,
        _redact_id(user_id),
        amount,
        status,
    )
