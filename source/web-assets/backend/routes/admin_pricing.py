"""
Admin Pricing Catalog Routes (Feb 2026)
─────────────────────────────────────────────────────────────────
Founder-only endpoints to change tier pricing without a redeploy.

Endpoints (all under /api/admin/pricing):
  GET  /catalogs                    — list every catalog + current version
  GET  /catalogs/{catalog_id}       — read one catalog's data
  PUT  /catalogs/{catalog_id}       — replace a catalog's data (admin only)
  PATCH /vip-tiers/{tier_id}        — quick path: update price/perks for one tier
  GET  /catalogs/{catalog_id}/history — last 25 versions for audit

Locked down by ``require_admin`` so only emails in ``ADMIN_EMAILS`` or
users with ``is_admin=True`` can mutate prices. Every mutation writes a
row to ``pricing_catalog_history`` for tamper-evident audit.
"""
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from config import db
from services import pricing_catalog
from utils.admin_guard import require_admin

router = APIRouter(prefix="/admin/pricing", tags=["admin-pricing"])


class CatalogUpdate(BaseModel):
    data: Dict[str, Any] = Field(..., description="Full catalog payload to persist")


class VipTierPatch(BaseModel):
    price_usd: float | None = None
    label: str | None = None
    tagline: str | None = None
    perks: List[str] | None = None


@router.get("/catalogs")
async def list_catalogs(admin=Depends(require_admin)) -> Dict[str, Any]:
    catalogs = []
    cursor = db.pricing_catalog.find({}, {"_id": 0})
    async for doc in cursor:
        catalogs.append({
            "catalog_id": doc.get("catalog_id"),
            "version": (doc.get("data") or {}).get("version"),
            "updated_at": doc.get("updated_at"),
            "updated_by": doc.get("updated_by"),
        })
    # Surface known catalog_ids that haven't been seeded yet so the
    # admin UI can still list them.
    known = set(pricing_catalog.CATALOG_DEFAULTS.keys())
    listed = {c["catalog_id"] for c in catalogs}
    for missing in known - listed:
        catalogs.append({
            "catalog_id": missing,
            "version": 0,
            "updated_at": None,
            "updated_by": None,
        })
    return {"catalogs": catalogs}


@router.get("/catalogs/{catalog_id}")
async def get_one_catalog(
    catalog_id: str, admin=Depends(require_admin)
) -> Dict[str, Any]:
    if catalog_id not in pricing_catalog.CATALOG_DEFAULTS:
        raise HTTPException(404, f"Unknown catalog '{catalog_id}'")
    data = await pricing_catalog.get_catalog(db, catalog_id)
    return {"catalog_id": catalog_id, "data": data}


@router.put("/catalogs/{catalog_id}")
async def replace_catalog(
    catalog_id: str,
    payload: CatalogUpdate,
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    if catalog_id not in pricing_catalog.CATALOG_DEFAULTS:
        raise HTTPException(404, f"Unknown catalog '{catalog_id}'")
    updated_by = getattr(admin, "email", None) or (
        admin.get("email") if isinstance(admin, dict) else None
    )
    persisted = await pricing_catalog.update_catalog(
        db, catalog_id, payload.data, updated_by=updated_by,
    )
    return {"catalog_id": catalog_id, "data": persisted}


@router.patch("/vip-tiers/{tier_id}")
async def patch_vip_tier(
    tier_id: str,
    patch: VipTierPatch,
    admin=Depends(require_admin),
) -> Dict[str, Any]:
    """Convenience: patch a single VIP tier without replaying the
    whole tier map. Validates the tier exists and writes a new version."""
    tiers = dict(await pricing_catalog.get_vip_tiers(db))
    if tier_id not in tiers:
        raise HTTPException(404, f"Unknown VIP tier '{tier_id}'")

    tier = dict(tiers[tier_id])
    if patch.price_usd is not None:
        if patch.price_usd <= 0:
            raise HTTPException(400, "price_usd must be > 0")
        tier["price_usd"] = float(patch.price_usd)
    if patch.label is not None:
        tier["label"] = patch.label
    if patch.tagline is not None:
        tier["tagline"] = patch.tagline
    if patch.perks is not None:
        tier["perks"] = list(patch.perks)
    tiers[tier_id] = tier

    updated_by = getattr(admin, "email", None) or (
        admin.get("email") if isinstance(admin, dict) else None
    )
    persisted = await pricing_catalog.update_catalog(
        db,
        "high_roller_vip_tiers",
        {"tiers": tiers},
        updated_by=updated_by,
    )
    return {"tier_id": tier_id, "tier": tier, "version": persisted.get("version")}


@router.get("/catalogs/{catalog_id}/history")
async def get_catalog_history(
    catalog_id: str, admin=Depends(require_admin)
) -> Dict[str, Any]:
    if catalog_id not in pricing_catalog.CATALOG_DEFAULTS:
        raise HTTPException(404, f"Unknown catalog '{catalog_id}'")
    cursor = (
        db.pricing_catalog_history.find({"catalog_id": catalog_id}, {"_id": 0})
        .sort("updated_at", -1)
        .limit(25)
    )
    history = [doc async for doc in cursor]
    return {"catalog_id": catalog_id, "history": history}
