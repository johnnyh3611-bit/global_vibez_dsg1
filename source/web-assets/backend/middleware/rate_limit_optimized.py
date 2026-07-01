"""
Optimized Rate Limiting
Protects against DDoS while allowing legitimate traffic
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Dict
import time
from collections import defaultdict


class OptimizedRateLimiter(BaseHTTPMiddleware):
    """
    Token bucket rate limiting algorithm
    More flexible than simple request counting
    """
    def __init__(
        self,
        app,
        requests_per_minute: int = 120,  # Increased from typical 60
        burst_size: int = 200,  # Allow bursts
        block_duration: int = 60  # Block for 1 minute if exceeded
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.burst_size = burst_size
        self.block_duration = block_duration
        
        # Token buckets per IP
        self.buckets: Dict[str, dict] = defaultdict(lambda: {
            "tokens": burst_size,
            "last_update": time.time(),
            "blocked_until": 0
        })
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request"""
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    def _refill_tokens(self, bucket: dict):
        """Refill tokens based on time passed"""
        now = time.time()
        time_passed = now - bucket["last_update"]
        
        # Add tokens based on time passed (tokens per second)
        tokens_to_add = time_passed * (self.requests_per_minute / 60)
        bucket["tokens"] = min(self.burst_size, bucket["tokens"] + tokens_to_add)
        bucket["last_update"] = now
    
    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        bucket = self.buckets[client_ip]
        
        # Check if client is currently blocked
        if time.time() < bucket["blocked_until"]:
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Try again in {int(bucket['blocked_until'] - time.time())} seconds"
            )
        
        # Refill tokens
        self._refill_tokens(bucket)
        
        # Check if enough tokens available
        if bucket["tokens"] >= 1:
            bucket["tokens"] -= 1
            response = await call_next(request)
            
            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
            response.headers["X-RateLimit-Remaining"] = str(int(bucket["tokens"]))
            
            return response
        else:
            # Rate limit exceeded - block for duration
            bucket["blocked_until"] = time.time() + self.block_duration
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Blocked for {self.block_duration} seconds"
            )


class SmartRateLimiter:
    """
    Adaptive rate limiting based on endpoint type
    Different limits for different routes
    """
    LIMITS = {
        "/api/auth/": {"rpm": 30, "burst": 50},  # Auth endpoints
        "/api/admin/": {"rpm": 60, "burst": 100},  # Admin endpoints
        "/api/games/": {"rpm": 200, "burst": 300},  # Game endpoints (high traffic)
        "/api/god-mode/": {"rpm": 120, "burst": 200},  # Monitoring
        "default": {"rpm": 120, "burst": 200}  # Default for other endpoints
    }
    
    @classmethod
    def get_limit_for_path(cls, path: str) -> dict:
        """Get rate limit configuration for a specific path"""
        for prefix, limits in cls.LIMITS.items():
            if path.startswith(prefix):
                return limits
        return cls.LIMITS["default"]
