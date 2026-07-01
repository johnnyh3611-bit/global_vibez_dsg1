"""
Simple in-memory cache for backend performance
Falls back to dict if Redis not available
"""
from datetime import datetime, timedelta
from typing import Any, Optional

class SimpleCache:
    def __init__(self):
        self._cache = {}
        self._expiry = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if key in self._cache:
            # Check if expired
            if key in self._expiry and datetime.now() > self._expiry[key]:
                del self._cache[key]
                del self._expiry[key]
                return None
            return self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: int = 300):
        """Set value in cache with TTL (seconds)"""
        self._cache[key] = value
        self._expiry[key] = datetime.now() + timedelta(seconds=ttl)
    
    def delete(self, key: str):
        """Delete value from cache"""
        if key in self._cache:
            del self._cache[key]
        if key in self._expiry:
            del self._expiry[key]
    
    def clear(self):
        """Clear all cache"""
        self._cache.clear()
        self._expiry.clear()
    
    def exists(self, key: str) -> bool:
        """Check if key exists and not expired"""
        return self.get(key) is not None

# Global cache instance
cache = SimpleCache()

def cache_response(key: str, ttl: int = 300):
    """Decorator for caching API responses"""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Try to get from cache
            cached = cache.get(key)
            if cached is not None:
                return cached
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            cache.set(key, result, ttl)
            return result
        return wrapper
    return decorator
