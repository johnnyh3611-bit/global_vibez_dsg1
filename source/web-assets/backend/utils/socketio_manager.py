"""Shared Socket.IO Redis client_manager factory for multi-instance scale-out.

Without a Redis pub/sub adapter, players in the same game room on different
FastAPI replicas never see each other's emits — the Socket.IO "room death trap".
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional
from urllib.parse import urlparse

import socketio

logger = logging.getLogger(__name__)


def _safe_redis_host(url: str) -> str:
    """Return host:port (or path) for logs — never credentials."""
    try:
        parsed = urlparse(url)
        if parsed.hostname:
            port = f":{parsed.port}" if parsed.port else ""
            return f"{parsed.hostname}{port}"
        # redis+sentinel / unix / opaque
        return url.split("@")[-1] if "@" in url else url.split("://", 1)[-1]
    except Exception:
        return "<redis>"


def build_socketio_client_manager() -> Optional[Any]:
    """
    Return ``socketio.AsyncRedisManager`` when ``REDIS_URL`` is set, else None.

    ``None`` keeps the default in-process manager (fine for single-replica
    local/dev). Production multi-replica deploys must set ``REDIS_URL``.
    """
    redis_url = (os.environ.get("REDIS_URL") or "").strip()
    if not redis_url:
        logger.info(
            "Socket.IO: REDIS_URL unset — in-process manager "
            "(single replica only; set REDIS_URL before scaling out)"
        )
        return None
    try:
        # python-socketio prefers redis.asyncio; falls back to aioredis 2.x
        manager = socketio.AsyncRedisManager(redis_url)
        logger.info(
            "Socket.IO: Redis client_manager enabled (%s)",
            _safe_redis_host(redis_url),
        )
        return manager
    except Exception as exc:
        logger.warning(
            "Socket.IO: Redis client_manager init failed (%s); "
            "falling back to in-process manager",
            type(exc).__name__,
        )
        return None
