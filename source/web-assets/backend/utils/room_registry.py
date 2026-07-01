"""
Multi-pod-safe room registry for SmartStack & Dominoes MP.

Two backends:
  • InMemoryRegistry — local dict, no cross-pod sharing. Default. Same
    semantics as the original `_ROOMS` / `_MATCHES` dicts.
  • RedisRegistry — uses redis.asyncio. Activated when `REDIS_URL` is
    set in the environment. Stores room metadata as JSON; cross-pod
    fan-out uses Redis pub/sub on a per-channel basis.

Public API (both backends):
  await reg.get(key) -> Optional[dict]
  await reg.set(key, value, ttl=None)
  await reg.delete(key)
  await reg.list(prefix='') -> list[dict]
  await reg.publish(channel, msg) -> None
  reg.subscribe(channel) -> async iterator yielding dicts

The two existing in-memory consumers (`routes/dominoes_mp._ROOMS` and
`routes/smartstack._ROOMS / _MATCHES`) keep working unchanged because
this module is opt-in. To migrate them, swap the dict for a registry
instance via `room_registry.get_registry()` — but that's a separate
PR. For now the adapter is here so the path forward is one swap, not
a rewrite, when scaling beyond one pod.
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from typing import Any, AsyncIterator, Dict, List, Optional


logger = logging.getLogger(__name__)


# ─── Backends ─────────────────────────────────────────────────────────


class _InMemoryRegistry:
    """Single-pod registry. Drop-in replacement semantics for the
    original `_ROOMS = {}` dicts."""

    def __init__(self) -> None:
        self._store: Dict[str, Dict[str, Any]] = {}
        self._channels: Dict[str, asyncio.Queue] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        return self._store.get(key)

    async def set(self, key: str, value: Dict[str, Any], ttl: Optional[int] = None) -> None:
        # ttl is honoured only on the Redis backend; in-memory ignores
        # it (acceptable for short-lived offer rooms).
        del ttl
        self._store[key] = value

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def list(self, prefix: str = "") -> List[Dict[str, Any]]:
        return [v for k, v in self._store.items() if k.startswith(prefix)]

    async def publish(self, channel: str, msg: Dict[str, Any]) -> None:
        q = self._channels.get(channel)
        if q is not None:
            await q.put(msg)

    async def subscribe(self, channel: str) -> AsyncIterator[Dict[str, Any]]:
        q: asyncio.Queue = asyncio.Queue(maxsize=128)
        async with self._lock:
            self._channels[channel] = q
        try:
            while True:
                msg = await q.get()
                yield msg
        finally:
            async with self._lock:
                if self._channels.get(channel) is q:
                    self._channels.pop(channel, None)


class _RedisRegistry:
    """Cross-pod registry. Lazy-imports `redis.asyncio` so deployments
    without redis installed don't pay the import cost."""

    def __init__(self, url: str) -> None:
        try:
            import redis.asyncio as redis_asyncio  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError(
                "REDIS_URL set but `redis` package not installed — "
                "run `pip install redis` and add to requirements.txt"
            ) from exc
        self._client = redis_asyncio.from_url(url, decode_responses=True)
        self._url = url
        logger.info("RedisRegistry initialised with %s", url)

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        raw = await self._client.get(key)
        return json.loads(raw) if raw else None

    async def set(self, key: str, value: Dict[str, Any], ttl: Optional[int] = None) -> None:
        await self._client.set(key, json.dumps(value), ex=ttl)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def list(self, prefix: str = "") -> List[Dict[str, Any]]:
        keys = await self._client.keys(f"{prefix}*")
        if not keys:
            return []
        raws = await self._client.mget(*keys)
        return [json.loads(r) for r in raws if r]

    async def publish(self, channel: str, msg: Dict[str, Any]) -> None:
        await self._client.publish(channel, json.dumps(msg))

    async def subscribe(self, channel: str) -> AsyncIterator[Dict[str, Any]]:
        pubsub = self._client.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for msg in pubsub.listen():
                if msg.get("type") == "message":
                    yield json.loads(msg["data"])
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()


# ─── Singleton selector ───────────────────────────────────────────────


_INSTANCE: Optional[Any] = None


def get_registry() -> Any:
    """Lazy singleton — picks the backend based on REDIS_URL env."""
    global _INSTANCE
    if _INSTANCE is not None:
        return _INSTANCE
    redis_url = os.environ.get("REDIS_URL", "").strip()
    if redis_url:
        try:
            _INSTANCE = _RedisRegistry(redis_url)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to init RedisRegistry, falling back: %s", exc)
            _INSTANCE = _InMemoryRegistry()
    else:
        _INSTANCE = _InMemoryRegistry()
    return _INSTANCE


def is_redis_enabled() -> bool:
    return isinstance(_INSTANCE, _RedisRegistry)
