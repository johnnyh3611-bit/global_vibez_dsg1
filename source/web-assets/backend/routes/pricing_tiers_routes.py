"""Pricing Tiers + Infrastructure Wallet — HTTP routes (v7.0 Phase 7).

PERSISTENCE (added 2026-02-15):
The InfraWallet ledger is now backed by MongoDB collection
`infra_wallet_ledger` so the closed-loop financial state survives backend
restarts. Creator wallets remain in-memory for now (test/dev scaffolding —
production reads from the canonical wallets collection).
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.pricing_tiers import (
    PRICING_TIERS, SERIES_BUNDLE_EPISODE_COUNT, SERIES_BUNDLE_PRICE,
    bundle_listing_cost,
    InfraWallet, CreatorWallet, InfraTransfer,
    process_upload,
)
from utils.database import get_database


pricing_router = APIRouter(prefix="/pricing", tags=["pricing-v7"])


# Live in-memory state — Mongo handles the LEDGER (canonical), creator
# wallets stay in-memory for v7 dev iterations.
_INFRA_WALLET: InfraWallet = InfraWallet()
_CREATOR_WALLETS: Dict[str, CreatorWallet] = {}
_INFRA_HYDRATED: bool = False
_INFRA_COLLECTION = "infra_wallet_ledger"


async def _hydrate_infra_from_mongo() -> None:
    """One-shot startup hydration. Reads every persisted ledger row into
    the in-memory InfraWallet so the running balance is correct after a
    backend restart."""
    global _INFRA_HYDRATED
    if _INFRA_HYDRATED:
        return
    try:
        db = get_database()
    except Exception:
        # Database not initialized yet (e.g. unit tests) — skip silently.
        _INFRA_HYDRATED = True
        return
    cursor = db[_INFRA_COLLECTION].find({}, {"_id": 0}).sort("transferred_at", 1)
    docs = await cursor.to_list(length=None)
    for d in docs:
        _INFRA_WALLET.deposit(InfraTransfer(
            transfer_id=d["transfer_id"],
            creator_id=d["creator_id"],
            content_type=d["content_type"],
            count=d["count"],
            amount=d["amount"],
            transferred_at=d["transferred_at"],
            note=d.get("note", ""),
        ))
    _INFRA_HYDRATED = True


async def _persist_transfer(transfer: InfraTransfer) -> None:
    try:
        db = get_database()
    except Exception:
        return
    await db[_INFRA_COLLECTION].insert_one({
        "transfer_id": transfer.transfer_id,
        "creator_id": transfer.creator_id,
        "content_type": transfer.content_type,
        "count": transfer.count,
        "amount": transfer.amount,
        "transferred_at": transfer.transferred_at,
        "note": transfer.note,
    })


def _get_or_create(creator_id: str) -> CreatorWallet:
    if creator_id not in _CREATOR_WALLETS:
        _CREATOR_WALLETS[creator_id] = CreatorWallet(creator_id=creator_id, balance=0.0)
    return _CREATOR_WALLETS[creator_id]


# ── PRICING TIERS ───────────────────────────────────────────────────────
@pricing_router.get("/tiers")
async def get_pricing_tiers() -> Dict:
    return {
        "tiers": PRICING_TIERS,
        "series_bundle_episode_count": SERIES_BUNDLE_EPISODE_COUNT,
        "series_bundle_price": SERIES_BUNDLE_PRICE,
        "doc": "v7 OMNI BLUEPRINT pricing — 'Buy 4 Get 1 Free' on SERIES_BUNDLE",
    }


@pricing_router.get("/quote")
async def get_listing_quote(content_type: str, count: int = 1) -> Dict:
    try:
        cost = bundle_listing_cost(content_type, count)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"content_type": content_type, "count": count, "cost_usd": cost}


# ── CREATOR WALLET ──────────────────────────────────────────────────────
class WalletDepositRequest(BaseModel):
    creator_id: str
    amount: float = Field(..., gt=0)


@pricing_router.post("/wallet/deposit")
async def wallet_deposit(req: WalletDepositRequest) -> Dict:
    w = _get_or_create(req.creator_id)
    w.balance = round(w.balance + req.amount, 4)
    return {"creator_id": w.creator_id, "balance": w.balance}


@pricing_router.get("/wallet/{creator_id}")
async def wallet_get(creator_id: str) -> Dict:
    w = _get_or_create(creator_id)
    return {"creator_id": w.creator_id, "balance": w.balance}


# ── PROCESS UPLOAD ──────────────────────────────────────────────────────
class ProcessUploadRequest(BaseModel):
    creator_id: str
    content_type: str
    count: int = Field(default=1, ge=1)


@pricing_router.post("/process-upload")
async def process_upload_endpoint(req: ProcessUploadRequest) -> Dict:
    await _hydrate_infra_from_mongo()
    creator = _get_or_create(req.creator_id)
    try:
        out = process_upload(creator, _INFRA_WALLET, req.content_type, req.count)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # On success the new transfer is the LAST ledger row — persist it.
    if out.ok and _INFRA_WALLET.ledger:
        await _persist_transfer(_INFRA_WALLET.ledger[-1])

    return {
        "ok": out.ok,
        "status": out.status,
        "cost_usd": out.cost,
        "creator_balance_after": out.creator_balance_after,
        "transfer_id": out.transfer_id,
        "unlocked_slots": out.unlocked_slots,
    }


# ── INFRA WALLET ────────────────────────────────────────────────────────
@pricing_router.get("/infra/balance")
async def infra_balance() -> Dict:
    await _hydrate_infra_from_mongo()
    return {
        "balance": _INFRA_WALLET.balance,
        "total_received": _INFRA_WALLET.total_received(),
        "transfer_count": len(_INFRA_WALLET.ledger),
    }


@pricing_router.get("/infra/ledger")
async def infra_ledger(limit: int = 50) -> Dict:
    await _hydrate_infra_from_mongo()
    rows = _INFRA_WALLET.ledger[-limit:] if limit > 0 else _INFRA_WALLET.ledger
    return {
        "count": len(rows),
        "ledger": [
            {
                "transfer_id": t.transfer_id,
                "creator_id": t.creator_id,
                "content_type": t.content_type,
                "count": t.count,
                "amount": t.amount,
                "transferred_at": t.transferred_at,
                "note": t.note,
            } for t in rows
        ],
    }


__all__ = ["pricing_router"]
