"""Scale-out cache + geo-index helper (Global Vibez 100K Production
Blueprint, May 2026).

Single source of truth for talking to Redis. Built so the rest of the
codebase can opt-in without breaking when Redis isn't configured:

    from services.scale_cache import cache_get, cache_set, geo_add

    cached = await cache_get("live_now_wall")
    if cached is None:
        rows = await db.streams.find(...).to_list(200)
        await cache_set("live_now_wall", rows, ttl=8)

If `REDIS_URL` is missing or Redis is unreachable, every helper here is
a graceful no-op (returns ``None`` / does nothing). That keeps the
production blueprint optional behind an env var so we never break the
beta launch.

Per the Blueprint PDF:
  • Redis is the canonical store for live driver geolocation (GEOADD)
  • Cache TTLs are short for the Live Now Wall (8 s) because clients
    already poll every 8 s — coalescing to 1 hit / 8 s / process
  • Lifetime burn / leaderboards / wallet balance can cache longer
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Iterable, Optional

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "")

# Default TTLs (seconds). Per Blueprint § Logistics + Live Now polling.
TTL_LIVE_WALL = 8           # matches client poll interval
TTL_LEADERBOARD = 60        # leaderboards refresh once a minute
TTL_BURN_COUNTER = 30       # economic engine snapshot
TTL_WALLET = 5              # wallet balance cache (short to avoid stale display)
TTL_DEFAULT = 30

_client = None  # lazily-initialised redis.asyncio client


async def _get_client():
    """Return a connected async Redis client, or None if disabled.

    Lazy import so the rest of the app doesn't pay redis-py import cost
    until someone actually touches the cache."""
    global _client
    if not REDIS_URL:
        return None
    if _client is not None:
        return _client
    try:
        import redis.asyncio as aioredis  # noqa: PLC0415
        _client = aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
        # Ping once so we fail fast on misconfig
        await _client.ping()
        logger.info("scale_cache: connected to Redis at %s", REDIS_URL)
        return _client
    except Exception as e:
        logger.warning("scale_cache: Redis unreachable (%s); falling back to no-op", e)
        _client = None
        return None


# ────────────────────────────────────────────── KV cache helpers ──
async def cache_get(key: str) -> Optional[Any]:
    cli = await _get_client()
    if cli is None:
        return None
    try:
        raw = await cli.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        logger.warning("scale_cache.get(%s) failed: %s", key, e)
        return None


async def cache_set(key: str, value: Any, ttl: int = TTL_DEFAULT) -> bool:
    cli = await _get_client()
    if cli is None:
        return False
    try:
        await cli.set(key, json.dumps(value, default=str), ex=ttl)
        return True
    except Exception as e:
        logger.warning("scale_cache.set(%s) failed: %s", key, e)
        return False


async def cache_delete(key: str) -> bool:
    cli = await _get_client()
    if cli is None:
        return False
    try:
        await cli.delete(key)
        return True
    except Exception:
        return False


# ────────────────────────────────────────────── Driver geo (Blueprint §3) ──
DRIVER_GEO_KEY = "driver_locations"


async def geo_add_driver(driver_id: str, longitude: float, latitude: float) -> bool:
    """Per Blueprint §Logistics: GEOADD the driver's live coords to a
    single Redis sorted-set so /nearby-drivers lookups are O(log N)
    instead of scanning the Mongo `drivers` collection."""
    cli = await _get_client()
    if cli is None:
        return False
    try:
        await cli.geoadd(DRIVER_GEO_KEY, (longitude, latitude, driver_id))
        return True
    except Exception as e:
        logger.warning("geo_add_driver(%s) failed: %s", driver_id, e)
        return False


async def geo_remove_driver(driver_id: str) -> bool:
    cli = await _get_client()
    if cli is None:
        return False
    try:
        await cli.zrem(DRIVER_GEO_KEY, driver_id)
        return True
    except Exception:
        return False


async def geo_nearby_drivers(
    longitude: float,
    latitude: float,
    radius_km: float = 10.0,
    limit: int = 50,
) -> list[dict]:
    """Return up to `limit` driver IDs + coords within `radius_km`.

    Empty list when Redis is unavailable — caller should fall back to
    the existing Mongo geo query."""
    cli = await _get_client()
    if cli is None:
        return []
    try:
        results = await cli.geosearch(
            DRIVER_GEO_KEY,
            longitude=longitude,
            latitude=latitude,
            radius=radius_km,
            unit="km",
            withcoord=True,
            withdist=True,
            count=limit,
            sort="ASC",
        )
    except Exception as e:
        logger.warning("geo_nearby_drivers failed: %s", e)
        return []
    out: list[dict] = []
    for row in results or []:
        # redis-py returns [name, dist, [lon, lat]]
        try:
            name, dist, coord = row[0], float(row[1]), row[2]
            out.append({
                "driver_id": name,
                "distance_km": dist,
                "lon": float(coord[0]),
                "lat": float(coord[1]),
            })
        except Exception:
            continue
    return out


# ────────────────────────────────────────────── Invalidation helpers ──
async def cache_bulk_delete(keys: Iterable[str]) -> int:
    cli = await _get_client()
    if cli is None:
        return 0
    n = 0
    for k in keys:
        try:
            n += await cli.delete(k)
        except Exception:
            continue
    return n


def is_redis_enabled() -> bool:
    """Cheap check for callers that want to skip work entirely when
    Redis isn't configured (e.g., feature flags)."""
    return bool(REDIS_URL)
