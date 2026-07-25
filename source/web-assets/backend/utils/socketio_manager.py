"""Shared Socket.IO Redis client_manager factory for multi-instance scale-out.

Without a Redis pub/sub adapter, players in the same game room on different
FastAPI replicas never see each other's emits — the Socket.IO "room death trap".

Set ``REDIS_URL`` (redis://… or rediss://…) on every multi-replica host.
In production, a missing or failed Redis adapter is logged as an error so
ops can see multi-replica desync risk immediately.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional
from urllib.parse import urlparse

import socketio

logger = logging.getLogger(__name__)


def _is_production() -> bool:
    env = (
        os.environ.get("ENVIRONMENT")
        or os.environ.get("ENV")
        or ""
    ).strip().lower()
    return env in ("production", "prod", "live")


def _safe_redis_host(url: str) -> str:
    """Return host:port (or path) for logs — never credentials."""
    try:
        parsed = urlparse(url)
        if parsed.hostname:
            port = f":{parsed.port}" if parsed.port else ""
            return f"{parsed.hostname}{port}"
        return url.split("@")[-1] if "@" in url else url.split("://", 1)[-1]
    except Exception:
        return "<redis>"


def redis_url_configured() -> bool:
    return bool((os.environ.get("REDIS_URL") or "").strip())


def build_socketio_client_manager() -> Optional[Any]:
    """
    Return ``socketio.AsyncRedisManager`` when ``REDIS_URL`` is set, else None.

    ``None`` keeps the default in-process manager (fine for single-replica
    local/dev). Production multi-replica deploys must set ``REDIS_URL``.
    """
    redis_url = (os.environ.get("REDIS_URL") or "").strip()
    prod = _is_production()
    if not redis_url:
        msg = (
            "Socket.IO: REDIS_URL unset — in-process manager "
            "(single replica only; set REDIS_URL before scaling out)"
        )
        if prod:
            logger.error(msg)
        else:
            logger.info(msg)
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
        msg = (
            "Socket.IO: Redis client_manager init failed (%s); "
            "falling back to in-process manager — multi-replica rooms will desync"
        )
        if prod:
            logger.error(msg, type(exc).__name__)
        else:
            logger.warning(msg, type(exc).__name__)
        return None


def socketio_adapter_status() -> dict:
    """Public readiness shape for integrations health / ops."""
    url = (os.environ.get("REDIS_URL") or "").strip()
    return {
        "redis_url_present": bool(url),
        "adapter": "redis" if url else "in_process",
        "multi_replica_ready": bool(url),
        "purpose": "Socket.IO pub/sub for multi-replica room sync",
        "set": "REDIS_URL",
    }
