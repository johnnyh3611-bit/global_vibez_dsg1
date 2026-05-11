"""
Content Rights & IP Protection — FastAPI routes.

Encodes `Content_Rights_And_IP_Policy.pdf` end-to-end. All endpoints
under `/api/content-rights/*`:

  Public:
    GET  /policy                 — full policy snapshot + live counters
    GET  /sample/{asset_id}      — free watermarked preview (no auth)
    POST /dmca/notice            — file a takedown (open form)

  Authed:
    POST /purchase/{asset_id}    — record purchase, mint signed token
    GET  /download/{token}       — redeem signed token → master URL

  Admin:
    GET  /admin/dmca/queue       — pending takedown notices
    POST /admin/dmca/decide      — uphold or dismiss a notice
    GET  /admin/strikes          — repeat-infringer roster
    POST /upload/preflight       — fingerprint + metadata + warranty check
                                   before file upload (called by seller flow)
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, EmailStr

from services import content_rights as cr
from utils.database import get_database, get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/content-rights", tags=["content-rights"])


def _user_id(user) -> str:
    if not user:
        raise HTTPException(status_code=401, detail="Auth required")
    uid = getattr(user, "user_id", None) or getattr(user, "id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid auth")
    return str(uid)


def _require_admin(user) -> None:
    if not user:
        raise HTTPException(status_code=401, detail="Auth required")
    if not (getattr(user, "is_admin", False) or getattr(user, "role", "") == "admin"):
        raise HTTPException(status_code=403, detail="Admin only")


# ────────────────────────────────────────────── Public ──

@router.get("/policy")
async def policy() -> Dict[str, Any]:
    """Public — full policy + live enforcement counters."""
    db = get_database()
    return await cr.policy_snapshot(db)


@router.get("/sample/{asset_id}")
async def sample(asset_id: str) -> Dict[str, Any]:
    """Free preview — returns the watermarked sample URL (if any),
    NEVER the master URL. Safe to call without auth so users can browse."""
    db = get_database()
    asset = await db.content_assets.find_one(
        {"asset_id": asset_id, "is_active": True},
        {"_id": 0, "asset_id": 1, "title": 1, "description": 1,
         "sample_url": 1, "price_usd": 1, "asset_type": 1, "owner_id": 1,
         "takedown_status": 1},
    )
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found or removed")
    if asset.get("takedown_status") == "upheld":
        raise HTTPException(status_code=410, detail="Asset removed per DMCA takedown")
    asset["sample_duration_seconds"] = cr.SAMPLE_DURATION_SECONDS
    return asset


# ────────────────────────────────────────────── Purchase + download ──

@router.post("/purchase/{asset_id}")
async def purchase(
    asset_id: str,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Record a verified purchase and mint a signed download token.

    NOTE: This endpoint trusts the calling flow (e.g. Beat Vault `/use`)
    to have already verified payment cleared. Downstream commerce
    routes call this rather than letting the client hit it directly."""
    db = get_database()
    try:
        return await cr.record_purchase(db, asset_id, _user_id(user))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/download/{token}")
async def download(token: str, user=Depends(get_current_user)):
    """Redeem a signed download token → 302 redirect to the master URL.

    Server-side validation:
      1. HMAC signature must verify
      2. Token must not be expired
      3. Authed user_id must match the token's user_id
      4. User must hold an active (non-refunded) license for this asset
    """
    try:
        decoded = cr.verify_download_token(token)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    uid = _user_id(user)
    if decoded["user_id"] != uid:
        raise HTTPException(status_code=403, detail="Token does not belong to you")

    db = get_database()
    if not await cr.has_active_license(db, decoded["asset_id"], uid):
        raise HTTPException(status_code=403, detail="No active license for this asset")

    asset = await db.content_assets.find_one(
        {"asset_id": decoded["asset_id"], "is_active": True},
        {"_id": 0, "master_url": 1, "takedown_status": 1},
    )
    if not asset or asset.get("takedown_status") == "upheld":
        raise HTTPException(status_code=410, detail="Asset is no longer available")
    if not asset.get("master_url"):
        raise HTTPException(status_code=404, detail="Master file not yet attached")

    return RedirectResponse(url=asset["master_url"], status_code=302)


# ────────────────────────────────────────────── DMCA ──

class DmcaNoticePayload(BaseModel):
    asset_id: str
    claimant_name: str = Field(..., min_length=2, max_length=120)
    claimant_email: EmailStr
    claim_text: str = Field(..., min_length=30, max_length=4000)
    claim_proof_url: Optional[str] = Field(default=None, max_length=500)


@router.post("/dmca/notice")
async def dmca_notice(payload: DmcaNoticePayload) -> Dict[str, Any]:
    """Public DMCA takedown form. No auth required — anyone can file.
    Asset is flagged `takedown_status=pending` immediately; admin
    decides within 24h per spec."""
    db = get_database()
    try:
        return await cr.submit_dmca_notice(
            db,
            asset_id=payload.asset_id,
            claimant_name=payload.claimant_name,
            claimant_email=payload.claimant_email,
            claim_text=payload.claim_text,
            claim_proof_url=payload.claim_proof_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ────────────────────────────────────────────── Admin tools ──

class PreflightPayload(BaseModel):
    seller_id: str
    title: str = Field(..., max_length=200)
    description: str = Field(default="", max_length=2000)
    fingerprint: str = Field(..., min_length=10, max_length=128)
    warranty_signed: bool = False


@router.post("/upload/preflight")
async def upload_preflight(
    payload: PreflightPayload,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Pre-upload check — fingerprint + metadata + warranty. Call this
    BEFORE the file hits storage so bad uploads never persist."""
    if not user:
        raise HTTPException(status_code=401, detail="Auth required")
    db = get_database()
    return await cr.preflight_upload(
        db,
        seller_id=payload.seller_id,
        title=payload.title,
        description=payload.description,
        fingerprint=payload.fingerprint,
        warranty_signed=payload.warranty_signed,
    )


@router.get("/admin/dmca/queue")
async def admin_dmca_queue(
    status_filter: str = Query(default="pending"),
    limit: int = Query(default=50, ge=1, le=500),
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(user)
    db = get_database()
    items = await db.content_rights_dmca.find(
        {"status": status_filter}, {"_id": 0}
    ).sort("submitted_at", -1).limit(limit).to_list(limit)
    return {"status": status_filter, "items": items, "count": len(items)}


class DmcaDecidePayload(BaseModel):
    notice_id: str
    decision: str  # upheld | dismissed
    note: Optional[str] = None


@router.post("/admin/dmca/decide")
async def admin_dmca_decide(
    payload: DmcaDecidePayload,
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(user)
    db = get_database()
    try:
        return await cr.admin_decide_dmca(
            db,
            notice_id=payload.notice_id,
            admin_user_id=_user_id(user),
            decision=payload.decision,
            note=payload.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/admin/strikes")
async def admin_strikes(
    limit: int = Query(default=100, ge=1, le=500),
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    _require_admin(user)
    db = get_database()
    rows: List[Dict[str, Any]] = await db.content_rights_strikes.find(
        {}, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {"strikes": rows, "count": len(rows)}
