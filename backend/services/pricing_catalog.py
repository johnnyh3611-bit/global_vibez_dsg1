"""
Pricing Catalog (Feb 2026)
─────────────────────────────────────────────────────────────────
MongoDB-backed pricing layer that lets the founder change tier
prices on the fly WITHOUT a redeploy.

Design
- Single collection ``pricing_catalog`` storing one document per
  ``catalog_id`` (e.g. ``"high_roller_vip_tiers"``).
- A small in-process TTL cache (60s) prevents hammering Mongo on
  every read — pricing data rarely changes and reads happen on
  hot paths (tier list, checkout).
- Each catalog has a hardcoded **DEFAULT** dict shipped in the
  Python module. On first boot the seeder writes those defaults
  into Mongo if missing. From that point on the document is the
  source of truth; admins mutate the doc via the admin endpoint.
- Any read failure falls back to the hardcoded defaults so the
  platform stays online even if Mongo is unreachable.

Currently catalogues:
  - ``high_roller_vip_tiers`` (Genius / Genesis / Apex)

Add new catalogues by appending an entry to ``CATALOG_DEFAULTS``
and (optionally) exposing a helper for type-safe reads.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from services.high_roller_economy import VIP_TIERS as _DEFAULT_VIP_TIERS

log = logging.getLogger(__name__)

# Defaults — these mirror the Python constants so the platform can
# boot without any DB content. ``seed_pricing_catalog`` copies these
# into Mongo on first boot (idempotent, never overwrites).
CATALOG_DEFAULTS: Dict[str, Dict[str, Any]] = {
    "high_roller_vip_tiers": {
        "tiers": _DEFAULT_VIP_TIERS,
        "version": 1,
    },
}

# 60s TTL cache. Pricing data is read on every /tiers and /checkout
# call; we don't want a Mongo round-trip on every request.
_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_TS: Dict[str, float] = {}
_CACHE_TTL_S = 60.0


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def seed_pricing_catalog(db) -> None:
    """Idempotently seed every catalog. Safe to run on every boot."""
    coll = db.pricing_catalog
    for catalog_id, defaults in CATALOG_DEFAULTS.items():
        existing = await coll.find_one({"catalog_id": catalog_id}, {"_id": 0})
        if existing:
            continue
        doc = {
            "catalog_id": catalog_id,
            "data": defaults,
            "seeded_at": _now_iso(),
            "updated_at": _now_iso(),
        }
        await coll.insert_one(doc)
        log.info("pricing_catalog seeded '%s'", catalog_id)


async def get_catalog(db, catalog_id: str) -> Dict[str, Any]:
    """Return the catalog ``data`` dict. Falls back to module defaults
    if Mongo is unreachable or the row was somehow purged."""
    cached_at = _CACHE_TS.get(catalog_id, 0)
    if (time.time() - cached_at) < _CACHE_TTL_S and catalog_id in _CACHE:
        return _CACHE[catalog_id]

    try:
        doc = await db.pricing_catalog.find_one(
            {"catalog_id": catalog_id}, {"_id": 0}
        )
        if doc and isinstance(doc.get("data"), dict):
            _CACHE[catalog_id] = doc["data"]
            _CACHE_TS[catalog_id] = time.time()
            return doc["data"]
    except Exception as exc:  # noqa: BLE001
        log.warning("pricing_catalog read failed for %s: %s", catalog_id, exc)

    # Fallback — never crash a price lookup.
    default = CATALOG_DEFAULTS.get(catalog_id, {})
    return default


async def update_catalog(
    db,
    catalog_id: str,
    data: Dict[str, Any],
    *,
    updated_by: Optional[str] = None,
) -> Dict[str, Any]:
    """Replace the catalog payload. Returns the persisted document.

    Bumps the version monotonically so clients (or audit dashboards)
    can detect drift. Invalidates the in-process cache so the next
    read fetches the fresh document.
    """
    if catalog_id not in CATALOG_DEFAULTS:
        raise ValueError(f"Unknown catalog_id '{catalog_id}'")

    existing = await db.pricing_catalog.find_one(
        {"catalog_id": catalog_id}, {"_id": 0}
    )
    prior_version = ((existing or {}).get("data") or {}).get("version", 0)
    payload = {**data, "version": prior_version + 1}

    await db.pricing_catalog.update_one(
        {"catalog_id": catalog_id},
        {
            "$set": {
                "data": payload,
                "updated_at": _now_iso(),
                "updated_by": updated_by,
            },
            "$setOnInsert": {"seeded_at": _now_iso()},
        },
        upsert=True,
    )

    # Audit row — keep a tamper-evident history of pricing changes.
    await db.pricing_catalog_history.insert_one({
        "catalog_id": catalog_id,
        "version": payload["version"],
        "data": payload,
        "updated_by": updated_by,
        "updated_at": _now_iso(),
    })

    _CACHE[catalog_id] = payload
    _CACHE_TS[catalog_id] = time.time()
    log.info(
        "pricing_catalog updated catalog=%s version=%d by=%s",
        catalog_id, payload["version"], updated_by,
    )
    return payload


def invalidate_cache(catalog_id: Optional[str] = None) -> None:
    """Drop the in-process cache. Used by tests + admin tooling."""
    if catalog_id is None:
        _CACHE.clear()
        _CACHE_TS.clear()
    else:
        _CACHE.pop(catalog_id, None)
        _CACHE_TS.pop(catalog_id, None)


# ─────────────────────────── Typed helpers ───────────────────────────
async def get_vip_tiers(db) -> Dict[str, Dict[str, Any]]:
    """Return the live VIP tier map: ``{tier_id: tier_doc}``."""
    catalog = await get_catalog(db, "high_roller_vip_tiers")
    tiers = catalog.get("tiers") if isinstance(catalog, dict) else None
    if isinstance(tiers, dict) and tiers:
        return tiers
    return _DEFAULT_VIP_TIERS


async def get_vip_tier_price_usd(db, tier_id: str) -> float:
    """Return the live USD price for a VIP tier. Raises if unknown."""
    tiers = await get_vip_tiers(db)
    if tier_id not in tiers:
        raise ValueError(f"Unknown VIP tier: {tier_id}")
    return float(tiers[tier_id]["price_usd"])
