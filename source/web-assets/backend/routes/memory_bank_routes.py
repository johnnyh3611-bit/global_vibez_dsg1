"""Vibe Memory Bank — HTTP routes (v6.5 Phase 4).

All under /api/memory-bank/*. In-memory registry for Phase 4 — the
admin "promote to MongoDB" migration is queued for Phase 7.
"""
from __future__ import annotations

import os
import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from services.memory_bank import (
    MemoryBankContent, MemoryBankLicense,
    settle_memory_bank_sale, issue_playback_url,
    verify_playback_request, filter_user_library,
    MEMORY_BANK_CREATOR_SHARE, MEMORY_BANK_PLATFORM_SHARE,
)


memory_bank_router = APIRouter(prefix="/memory-bank", tags=["memory-bank"])

_CONTENT_REGISTRY: Dict[str, MemoryBankContent] = {}
_LICENSE_REGISTRY: Dict[str, MemoryBankLicense] = {}


# ──────────────────────────────────────────────────────────────────────────
# CONTENT MANAGEMENT
# ──────────────────────────────────────────────────────────────────────────
class PublishContentRequest(BaseModel):
    creator_id: str
    title: str = Field(..., min_length=1, max_length=200)
    price: float = Field(..., gt=0)
    duration_minutes: int = Field(..., gt=0)
    genre: str
    rating: str = "PG-13"
    cover_art_url: Optional[str] = None


@memory_bank_router.post("/content/publish")
def content_publish(req: PublishContentRequest) -> Dict:
    cid = str(uuid.uuid4())
    content = MemoryBankContent(
        content_id=cid, creator_id=req.creator_id, title=req.title,
        price=req.price, duration_minutes=req.duration_minutes,
        genre=req.genre, rating=req.rating, cover_art_url=req.cover_art_url,
    )
    _CONTENT_REGISTRY[cid] = content
    return {**content.__dict__}


@memory_bank_router.get("/content")
def content_list(genre: Optional[str] = None) -> Dict:
    items = [c for c in _CONTENT_REGISTRY.values() if c.is_active]
    if genre:
        items = [c for c in items if c.genre.lower() == genre.lower()]
    return {"content": [c.__dict__ for c in items]}


@memory_bank_router.get("/content/{content_id}")
def content_get(content_id: str) -> Dict:
    content = _CONTENT_REGISTRY.get(content_id)
    if not content or not content.is_active:
        raise HTTPException(status_code=404, detail="content not found")
    return content.__dict__


# ──────────────────────────────────────────────────────────────────────────
# PURCHASE — issue a license
# ──────────────────────────────────────────────────────────────────────────
class PurchaseRequest(BaseModel):
    content_id: str
    buyer_id: str


@memory_bank_router.post("/purchase")
def purchase(req: PurchaseRequest) -> Dict:
    content = _CONTENT_REGISTRY.get(req.content_id)
    if not content:
        raise HTTPException(status_code=404, detail="content not found")
    try:
        license = settle_memory_bank_sale(content, req.buyer_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _LICENSE_REGISTRY[license.license_id] = license
    return license.to_dict()


# ──────────────────────────────────────────────────────────────────────────
# LIBRARY — what does this user own?
# ──────────────────────────────────────────────────────────────────────────
@memory_bank_router.get("/library/{user_id}")
def library(user_id: str) -> Dict:
    licenses = filter_user_library(list(_LICENSE_REGISTRY.values()), user_id)
    items = []
    for lic in licenses:
        c = _CONTENT_REGISTRY.get(lic.content_id)
        items.append({
            "license_id": lic.license_id,
            "content_id": lic.content_id,
            "title": c.title if c else "(unknown)",
            "duration_minutes": c.duration_minutes if c else 0,
            "purchased_at": lic.purchased_at,
            "purchase_price": lic.purchase_price,
            "status": lic.status,
        })
    return {"user_id": user_id, "library": items, "owned_count": len(items)}


# ──────────────────────────────────────────────────────────────────────────
# DRM — issue a signed playback URL
# ──────────────────────────────────────────────────────────────────────────
class IssuePlaybackRequest(BaseModel):
    license_id: str


@memory_bank_router.post("/playback/url")
def playback_url(req: IssuePlaybackRequest, http_request: Request) -> Dict:
    lic = _LICENSE_REGISTRY.get(req.license_id)
    if not lic:
        raise HTTPException(status_code=404, detail="license not found")
    base_url = str(http_request.base_url)
    try:
        return issue_playback_url(lic, base_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@memory_bank_router.get("/play")
def playback_verify(
    lid: str, buyer: str, cid: str, exp: str, sig: str,
    requesting_user_id: str = Query(..., description="The user_id of the watching account"),
) -> Dict:
    """Validate a signed playback URL. The frontend player would hit this
    first; if `ok: true`, it then streams the actual media file from the
    CDN-protected origin (out-of-scope for Phase 4 — placeholder)."""
    result = verify_playback_request(
        license_id=lid, buyer_id=buyer, content_id=cid,
        expires=exp, signature=sig, requesting_user_id=requesting_user_id,
    )
    return result


# ──────────────────────────────────────────────────────────────────────────
# CONSTANTS / PAYTABLE
# ──────────────────────────────────────────────────────────────────────────
@memory_bank_router.get("/constants")
def memory_bank_constants() -> Dict:
    return {
        "creator_share": MEMORY_BANK_CREATOR_SHARE,
        "platform_share": MEMORY_BANK_PLATFORM_SHARE,
        "doc": (
            "Vibe Memory Bank: 70% to creator / 30% to platform on every "
            "sale. Files are licensed to the buyer's account (HMAC-signed "
            "playback URLs, 1-hour TTL). No exporting, no re-sale — that "
            "is the 70/30 Lifecycle from OMNI Master v6.5."
        ),
    }


__all__ = ["memory_bank_router"]
