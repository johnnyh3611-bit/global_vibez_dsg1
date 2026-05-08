"""
JFTN (Just for the Night) — Solana payment + 24-hour pass + 72-hour escrow.

This module implements the spec the user dropped:
  - User pays SOL to a creator's wallet on Solana Devnet
  - Backend verifies the on-chain signature via Solana Devnet RPC
  - A `jftn_passes` doc is created with status=HOLD, expires_at = +24h,
    payout_eligible_at = +72h
  - Admin can release / freeze the held funds via /api/admin/jftn/*
  - UE5 client polls /api/ue5/check-access/{wallet} to gate the welcome scene

DEVNET-ONLY for now. No mainnet wiring. Mock signatures (prefix "MOCK_")
are accepted so the flow can be demoed without a real Phantom wallet.
"""

import os
import uuid
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from utils.database import get_database, get_current_user
from routes.admin import verify_admin

router = APIRouter()

# Devnet RPC. Override via .env when ready to flip to mainnet.
SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.devnet.solana.com")


# ============================================================
# MODELS
# ============================================================

class PurchasePassRequest(BaseModel):
    creator_id: str
    creator_wallet: str
    room_id: Optional[str] = None
    # Currency: primary path is Vibez Coins (₵). Solana is an alternative.
    payment_method: str = Field(default="coins", pattern="^(coins|solana)$")
    entry_coins: Optional[int] = Field(default=None, gt=0)  # required when payment_method == coins
    entry_fee_sol: Optional[float] = Field(default=None, gt=0, le=10)  # required when solana
    signature: Optional[str] = None  # Solana tx signature OR "MOCK_*" — solana path only


class ReleaseRequest(BaseModel):
    notes: Optional[str] = None


class FreezeRequest(BaseModel):
    reason: str


# ============================================================
# HELPERS
# ============================================================

async def _verify_solana_signature(signature: str, expected_amount_sol: float) -> Dict[str, Any]:
    """Look up a Solana tx by signature on Devnet RPC.

    Returns {ok: bool, slot: int|None, error: str|None}. Mock signatures
    (prefix MOCK_) auto-pass so the flow stays demoable without real SOL.
    """
    if signature.startswith("MOCK_"):
        return {"ok": True, "slot": 0, "mock": True, "error": None}

    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTransaction",
        "params": [signature, {"encoding": "json", "commitment": "confirmed"}],
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(SOLANA_RPC_URL, json=payload)
            data = resp.json()
        if not data.get("result"):
            return {"ok": False, "slot": None, "mock": False, "error": "Transaction not found on Devnet"}
        slot = data["result"].get("slot")
        return {"ok": True, "slot": slot, "mock": False, "error": None}
    except Exception as exc:
        return {"ok": False, "slot": None, "mock": False, "error": f"RPC error: {exc}"}


def _serialize_pass(pass_doc: Dict[str, Any]) -> Dict[str, Any]:
    """Drop _id and convert datetimes to ISO so MongoDB docs are JSON-safe."""
    out = {k: v for k, v in pass_doc.items() if k != "_id"}
    for key in ("purchased_at", "expires_at", "payout_eligible_at",
                "released_at", "frozen_at"):
        if isinstance(out.get(key), datetime):
            out[key] = out[key].isoformat()
    return out


# ============================================================
# USER ENDPOINTS — purchase + verify + active pass + room gate
# ============================================================

@router.post("/jftn/passes/purchase")
async def purchase_pass(payload: PurchasePassRequest, request: Request):
    """Buy a 24-hour JFTN pass. Two payment paths:
      • Vibez Coins (₵) — PRIMARY. Debits the user's wallet balance, no chain
        verification. Fast, friction-free.
      • Solana — ALTERNATIVE. Verifies an on-chain tx signature on Devnet.
    Either path creates a `jftn_passes` doc with a 72-hour escrow timer.
    """
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_database()
    now = datetime.now(timezone.utc)
    pass_id = f"jftn_{uuid.uuid4().hex[:12]}"
    method = payload.payment_method

    # ----- VIBEZ COINS (primary) -----
    if method == "coins":
        if not payload.entry_coins:
            raise HTTPException(status_code=422, detail="entry_coins required for coin payment")
        # Use the canonical platform wallet field `credits_balance`
        # (same field as auth/me, vibe_wallet, beta seeder, ambassador
        # commissions). Earlier this read `vibez_coins` which was its
        # own ledger nobody topped up — so every coin-pay buy-in 402'd.
        wallet = await db.users.find_one(
            {"user_id": user.user_id},
            {"_id": 0, "credits_balance": 1},
        )
        balance = int((wallet or {}).get("credits_balance", 0) or 0)
        if balance < payload.entry_coins:
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient Vibez Coins (need ₵{payload.entry_coins}, have ₵{balance})",
            )
        # Atomic debit on the same field — guarded by the wallet
        # condition so two simultaneous purchases can't overdraw.
        result = await db.users.update_one(
            {"user_id": user.user_id, "credits_balance": {"$gte": payload.entry_coins}},
            {"$inc": {"credits_balance": -payload.entry_coins}},
        )
        if result.modified_count == 0:
            raise HTTPException(
                status_code=402,
                detail="Insufficient Vibez Coins (race detected — please retry)",
            )
        new_pass = {
            "pass_id": pass_id,
            "user_id": user.user_id,
            "user_email": user.email,
            "creator_id": payload.creator_id,
            "creator_wallet": payload.creator_wallet,
            "room_id": payload.room_id,
            "payment_method": "coins",
            "entry_coins": payload.entry_coins,
            "entry_fee_sol": None,
            "signature": None,
            "is_mock": False,
            "status": "HOLD",
            "is_active": True,
            "purchased_at": now,
            "expires_at": now + timedelta(hours=24),
            "payout_eligible_at": now + timedelta(hours=72),
            "released_at": None,
            "frozen_at": None,
        }
        await db.jftn_passes.insert_one(new_pass)
        return {
            "success": True,
            "pass": _serialize_pass(new_pass),
            "verification": {"ok": True, "method": "coins"},
        }

    # ----- SOLANA (alternative) -----
    if not payload.signature or not payload.entry_fee_sol:
        raise HTTPException(status_code=422, detail="signature + entry_fee_sol required for solana payment")
    verification = await _verify_solana_signature(payload.signature, payload.entry_fee_sol)
    if not verification["ok"]:
        raise HTTPException(status_code=402, detail=verification["error"] or "Payment not verified")

    if await db.jftn_passes.find_one({"signature": payload.signature}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="Signature already redeemed")

    new_pass = {
        "pass_id": pass_id,
        "user_id": user.user_id,
        "user_email": user.email,
        "creator_id": payload.creator_id,
        "creator_wallet": payload.creator_wallet,
        "room_id": payload.room_id,
        "payment_method": "solana",
        "entry_coins": None,
        "entry_fee_sol": payload.entry_fee_sol,
        "signature": payload.signature,
        "is_mock": verification.get("mock", False),
        "status": "HOLD",
        "is_active": True,
        "purchased_at": now,
        "expires_at": now + timedelta(hours=24),
        "payout_eligible_at": now + timedelta(hours=72),
        "released_at": None,
        "frozen_at": None,
    }
    await db.jftn_passes.insert_one(new_pass)
    return {
        "success": True,
        "pass": _serialize_pass(new_pass),
        "verification": verification,
    }


@router.get("/jftn/passes/active")
async def get_active_pass(request: Request, room_id: Optional[str] = None):
    """Return the user's currently active 24-hour pass (if any)."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_database()
    query: Dict[str, Any] = {
        "user_id": user.user_id,
        "is_active": True,
        "expires_at": {"$gt": datetime.now(timezone.utc)},
    }
    if room_id:
        query["room_id"] = room_id

    doc = await db.jftn_passes.find_one(query, {"_id": 0}, sort=[("purchased_at", -1)])
    if not doc:
        return {"has_active_pass": False, "pass": None}
    return {"has_active_pass": True, "pass": _serialize_pass(doc)}


@router.get("/jftn/enter/{room_id}")
async def enter_room(room_id: str, request: Request):
    """Gate room entry: must hold a non-expired active pass for this room."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_database()
    now = datetime.now(timezone.utc)
    active = await db.jftn_passes.find_one({
        "user_id": user.user_id,
        "room_id": room_id,
        "is_active": True,
        "expires_at": {"$gt": now},
    }, {"_id": 0})

    if not active:
        raise HTTPException(
            status_code=403,
            detail="Pass expired or missing. Purchase a 24-hour pass to enter.",
        )

    return {
        "status": "Access Granted",
        "expires_at": active["expires_at"].isoformat() if isinstance(active["expires_at"], datetime) else active["expires_at"],
    }


# ============================================================
# UE5 ENDPOINT — external Unreal client polls this to gate scene
# ============================================================

@router.get("/ue5/check-access/{user_wallet}")
async def ue5_check_access(user_wallet: str):
    """Called by an external UE5 / Pixel-Streaming client. Returns whether
    the wallet currently holds an active 24-hour pass + a dealer line for
    the welcome animation. Public on purpose — UE5 clients can't auth-cookie.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    active = await db.jftn_passes.find_one({
        "creator_wallet": user_wallet,  # accept either field for flexibility
        "is_active": True,
        "expires_at": {"$gt": now},
    }, {"_id": 0}) or await db.jftn_passes.find_one({
        "user_email": user_wallet,
        "is_active": True,
        "expires_at": {"$gt": now},
    }, {"_id": 0})

    if active:
        return {
            "access_granted": True,
            "animation_trigger": "Welcome_Sequence",
            "dealer_line": "Welcome to the inner circle. Your seat is ready.",
            "expires_at": active["expires_at"].isoformat() if isinstance(active["expires_at"], datetime) else active["expires_at"],
        }
    return {
        "access_granted": False,
        "animation_trigger": "Locked_Door",
        "dealer_line": "I don't see you on the list tonight.",
    }


# ============================================================
# ADMIN (GOD-MODE) — escrow review + release/freeze
# ============================================================

@router.get("/admin/jftn/escrow-pending")
async def admin_escrow_pending(request: Request, limit: int = 50):
    """All passes still in HOLD that have crossed the 72-hour threshold."""
    await verify_admin(request)
    db = get_database()
    threshold = datetime.now(timezone.utc) - timedelta(hours=72)
    cursor = db.jftn_passes.find(
        {"status": "HOLD", "purchased_at": {"$lte": threshold}},
        {"_id": 0},
    ).sort("purchased_at", 1).limit(limit)
    docs = [_serialize_pass(d) async for d in cursor]
    total_hold = await db.jftn_passes.count_documents({"status": "HOLD"})
    return {
        "ready_for_release": docs,
        "ready_count": len(docs),
        "total_in_escrow": total_hold,
    }


@router.get("/admin/jftn/escrow-summary")
async def admin_escrow_summary(request: Request):
    """Quick counters for the God-Mode dashboard cards."""
    await verify_admin(request)
    db = get_database()

    # Coins summary
    coins_pipeline = [
        {"$match": {"status": "HOLD", "payment_method": "coins"}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "total_coins": {"$sum": "$entry_coins"}}},
    ]
    coins_agg = await db.jftn_passes.aggregate(coins_pipeline).to_list(1)
    coins_held = coins_agg[0] if coins_agg else {"count": 0, "total_coins": 0}

    # SOL summary (legacy + crypto users)
    sol_pipeline = [
        {"$match": {"status": "HOLD", "payment_method": {"$ne": "coins"}}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "total_sol": {"$sum": "$entry_fee_sol"}}},
    ]
    sol_agg = await db.jftn_passes.aggregate(sol_pipeline).to_list(1)
    sol_held = sol_agg[0] if sol_agg else {"count": 0, "total_sol": 0}

    released = await db.jftn_passes.count_documents({"status": "RELEASED"})
    frozen = await db.jftn_passes.count_documents({"status": "FROZEN"})
    return {
        "held_count": coins_held.get("count", 0) + sol_held.get("count", 0),
        "held_total_coins": int(coins_held.get("total_coins", 0) or 0),
        "held_total_sol": float(sol_held.get("total_sol", 0) or 0),
        "released_count": released,
        "frozen_count": frozen,
    }


@router.post("/admin/jftn/release/{pass_id}")
async def admin_release(pass_id: str, payload: ReleaseRequest, request: Request):
    """Mark an escrow as RELEASED. (Actual Solana transfer-out is out of
    scope for the dev pod — this just flips the DB record so an off-chain
    worker / future signer can act on it.)"""
    admin = await verify_admin(request)
    db = get_database()
    doc = await db.jftn_passes.find_one({"pass_id": pass_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pass not found")
    if doc.get("status") != "HOLD":
        raise HTTPException(status_code=409, detail=f"Pass is {doc.get('status')}, not HOLD")

    now = datetime.now(timezone.utc)
    await db.jftn_passes.update_one(
        {"pass_id": pass_id},
        {"$set": {
            "status": "RELEASED",
            "released_at": now,
            "released_by": getattr(admin, "user_id", None),
            "release_notes": payload.notes,
        }},
    )
    return {"success": True, "pass_id": pass_id, "status": "RELEASED"}


@router.post("/admin/jftn/freeze/{pass_id}")
async def admin_freeze(pass_id: str, payload: FreezeRequest, request: Request):
    """Freeze a held escrow indefinitely (e.g., suspected fraud)."""
    admin = await verify_admin(request)
    db = get_database()
    doc = await db.jftn_passes.find_one({"pass_id": pass_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pass not found")
    if doc.get("status") == "RELEASED":
        raise HTTPException(status_code=409, detail="Cannot freeze an already-released pass")

    now = datetime.now(timezone.utc)
    await db.jftn_passes.update_one(
        {"pass_id": pass_id},
        {"$set": {
            "status": "FROZEN",
            "frozen_at": now,
            "frozen_by": getattr(admin, "user_id", None),
            "freeze_reason": payload.reason,
            "is_active": False,
        }},
    )
    return {"success": True, "pass_id": pass_id, "status": "FROZEN"}
