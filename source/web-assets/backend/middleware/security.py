"""
Rate Limiting & Security Middleware
Protects against abuse and DOS attacks
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from typing import Dict
import time

# In-memory rate limit store (use Redis in production)
rate_limit_store: Dict[str, list] = {}

class RateLimitConfig:
    """Rate limit configuration"""
    REQUESTS_PER_MINUTE = 60
    REQUESTS_PER_HOUR = 1000
    BAN_THRESHOLD = 5000  # Auto-ban if exceeded

async def rate_limit_middleware(request: Request, call_next):
    """
    Rate limiting middleware.
    Tracks requests per IP and enforces limits.
    """
    # Skip rate limiting for health checks
    if request.url.path in ["/health", "/api/health"]:
        return await call_next(request)

    client_ip = request.client.host
    current_time = time.time()
    per_minute, per_hour = _record_request(client_ip, current_time)

    over_minute = _exceeded_response(
        per_minute, RateLimitConfig.REQUESTS_PER_MINUTE, "minute", 60,
    )
    if over_minute:
        return over_minute

    over_hour = _exceeded_response(
        per_hour, RateLimitConfig.REQUESTS_PER_HOUR, "hour", 3600,
    )
    if over_hour:
        return over_hour

    if per_hour > RateLimitConfig.BAN_THRESHOLD:
        # TODO: Add to ban list
        print(f"⚠️ IP {client_ip} exceeded ban threshold: {per_hour} requests/hour")

    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(RateLimitConfig.REQUESTS_PER_MINUTE)
    response.headers["X-RateLimit-Remaining"] = str(
        max(0, RateLimitConfig.REQUESTS_PER_MINUTE - per_minute)
    )
    response.headers["X-RateLimit-Reset"] = str(int(current_time + 60))
    return response


def _record_request(client_ip: str, now: float) -> tuple:
    """Append `now` to the IP's bucket, prune old entries, return
    (requests_in_last_minute, requests_in_last_hour)."""
    bucket = rate_limit_store.setdefault(client_ip, [])
    # Drop anything older than an hour
    bucket[:] = [t for t in bucket if now - t < 3600]
    bucket.append(now)
    per_minute = sum(1 for t in bucket if now - t < 60)
    return per_minute, len(bucket)


def _exceeded_response(count: int, limit: int, period: str, retry_after: int):
    """Return a 429 JSONResponse when `count` is over `limit`, else None."""
    if count <= limit:
        return None
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "message": f"Maximum {limit} requests per {period}",
            "retry_after": retry_after,
        },
    )

# Input Validation Helpers
def sanitize_string(text: str, max_length: int = 500) -> str:
    """Sanitize user input strings"""
    if not text:
        return ""
    
    # Remove potential script tags
    text = text.replace("<script>", "").replace("</script>", "")
    text = text.replace("<", "&lt;").replace(">", "&gt;")
    
    # Limit length
    return text[:max_length].strip()

def validate_email(email: str) -> bool:
    """Validate email format"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_user_id(user_id: str) -> bool:
    """Validate user ID format"""
    import re
    # UUID format or alphanumeric
    pattern = r'^[a-zA-Z0-9_-]{8,64}$'
    return bool(re.match(pattern, user_id))

def validate_amount(amount: float, min_val: float = 0, max_val: float = 1000000) -> bool:
    """Validate monetary amounts"""
    return min_val <= amount <= max_val

class SecurityHeaders:
    """Add security headers to all responses"""
    
    @staticmethod
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        return response
