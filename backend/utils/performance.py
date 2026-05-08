"""
Performance monitoring and optimization utilities
"""
import time
import functools
from typing import Callable
import logging

logger = logging.getLogger(__name__)

def measure_time(func: Callable):
    """Decorator to measure function execution time"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        start = time.time()
        result = await func(*args, **kwargs)
        duration = time.time() - start
        
        if duration > 1.0:  # Log slow queries (>1 second)
            logger.warning(f"Slow query: {func.__name__} took {duration:.2f}s")
        
        return result
    return wrapper


def batch_database_queries(queries: list, db):
    """Execute multiple database queries in parallel"""
    import asyncio
    return asyncio.gather(*queries)


class QueryOptimizer:
    """Optimize database queries"""
    
    @staticmethod
    def get_projection(fields: list) -> dict:
        """Create MongoDB projection to fetch only needed fields"""
        projection = {"_id": 0}  # Always exclude _id
        for field in fields:
            projection[field] = 1
        return projection
    
    @staticmethod
    def create_index_hint(index_name: str) -> dict:
        """Create index hint for query"""
        return {"hint": index_name}
