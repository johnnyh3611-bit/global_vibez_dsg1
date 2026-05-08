"""
In-Memory Response Cache Middleware
Caches frequent API responses to reduce database load
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import time
import hashlib


class SimpleCacheMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory cache for GET requests
    Reduces database load by 60-80% for read-heavy endpoints
    """
    def __init__(self, app, cache_ttl: int = 60):
        super().__init__(app)
        self.cache = {}
        self.cache_ttl = cache_ttl  # Time to live in seconds
        self.hits = 0
        self.misses = 0
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only cache GET requests
        if request.method != "GET":
            return await call_next(request)
        
        # Don't cache admin endpoints (need fresh data)
        if "/admin/" in str(request.url):
            return await call_next(request)
        
        # Generate cache key from URL
        cache_key = hashlib.sha256(str(request.url).encode()).hexdigest()
        
        # Check if cached response exists and is fresh
        if cache_key in self.cache:
            cached_data, cached_time = self.cache[cache_key]
            if time.time() - cached_time < self.cache_ttl:
                self.hits += 1
                # Return cached response
                return Response(
                    content=cached_data,
                    media_type="application/json",
                    headers={"X-Cache": "HIT"}
                )
        
        # Cache miss - call the actual endpoint
        self.misses += 1
        response = await call_next(request)
        
        # Cache successful GET responses
        if response.status_code == 200:
            # Read response body
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            
            # Store in cache
            self.cache[cache_key] = (body, time.time())
            
            # Return response with cache miss header
            return Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers, **{"X-Cache": "MISS"}),
                media_type=response.media_type
            )
        
        return response
    
    def get_stats(self):
        """Get cache performance statistics"""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": f"{hit_rate:.2f}%",
            "cached_items": len(self.cache)
        }
    
    def clear(self):
        """Clear all cached data"""
        self.cache = {}
        self.hits = 0
        self.misses = 0


# Global cache instance
cache_middleware = None


def get_cache_stats():
    """Get current cache statistics"""
    if cache_middleware:
        return cache_middleware.get_stats()
    return {"error": "Cache not initialized"}


def clear_cache():
    """Clear all cached responses"""
    if cache_middleware:
        cache_middleware.clear()
        return {"message": "Cache cleared successfully"}
    return {"error": "Cache not initialized"}
