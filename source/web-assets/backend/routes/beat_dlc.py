"""
Beat Vault DLC — finished-track Vibe DLC mint flow.
─────────────────────────────────────────────────────────────────────
Streamer Revenue Blueprint §3 + Master Tech Blueprint §1 require that
finished tracks be minted as Vibe DLC entries that retail users can
"unlock" with credits, with the artist keeping the locked 70% share.

MAINNET status: the Solana SPL mint authority is held by the
Squads multisig and is GATED until the founder utters the
project-complete safe phrase. Until then `mint_status` is set to
`SIMULATED` and the on-chain TX hash is a deterministic fingerprint
of the track payload. The economics, ledger entries, and frontend
flow are otherwise identical so the user can test end-to-end.

Endpoints (mounted under /api):
  POST /beat-dlc/mint           — auth; record a mint intent
  GET  /beat-dlc/list/{artist}  — public; finished DLCs for an artist
"""
from __future__ import annotations

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Final, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/beat-dlc", tags=["beat-dlc"])

# Locked share (mirrors Streamer Action Hub + Immutable Core)
ARTIST_SHARE:    Final[float] = 0.70
SOVEREIGN_TAX:   Final[float] = 0.135
LIQUIDITY_POOL:  Final[float] = 0.10

# Sentinel: until the founder confirms project_complete, every mint is
# SIMULATED. Flip to PRODUCTION via env var on the day of launch.
import os
MINT_MODE: Final[str] = os.environ.get("BEAT_DLC_MINT_MODE", "SIMULATED")


class MintPayload(BaseModel):
    track_title: str
    artist_id:   str
    cover_art_url: Optional[str] = None
    unlock_price_cents: int = Field(..., gt=0)
    stems: List[str] = Field(default_factory=list,
        description="Stem identifiers from the Beat Vault session")


def _deterministic_tx_hash(payload: Dict[str, Any]) -> str:
    """Stable fake-tx-hash so that the simulated mint reads the same
    on every retry of the same payload. NOT cryptographically signed —
    just a pretty fingerprint for the UI."""
    blob = f"{payload['artist_id']}|{payload['track_title']}|{payload['unlock_price_cents']}"
    return "0x" + hashlib.sha256(blob.encode()).hexdigest()[:48]


@router.post("/mint")
async def mint_dlc(payload: MintPayload, request: Request) -> Dict[str, Any]:
    """Record a mint intent for a finished Beat Vault track.

    The artist's wallet is credited the moment the first listener
    unlocks (handled by the existing Streamer Action Hub on
    `INSTRUMENT_GIFT`). This endpoint just persists the canonical
    DLC entry and returns a fingerprint so the UI can render it.
    """
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    dlc_id = f"dlc_{uuid.uuid4().hex[:12]}"
    body = payload.model_dump()
    body.update({
        "dlc_id":        dlc_id,
        "minter_id":     user.user_id,
        "tx_hash":       _deterministic_tx_hash(body),
        "mint_status":   MINT_MODE,    # SIMULATED until mainnet
        "share_split": {
            "artist":         ARTIST_SHARE,
            "sovereign_tax":  SOVEREIGN_TAX,
            "liquidity_pool": LIQUIDITY_POOL,
        },
        "minted_at":     datetime.now(timezone.utc).isoformat(),
    })
    await db.beat_dlc_mints.insert_one(body)

    return {
        "dlc_id":      dlc_id,
        "tx_hash":     body["tx_hash"],
        "mint_status": MINT_MODE,
        "track_title": payload.track_title,
        "unlock_price_cents": payload.unlock_price_cents,
        "share_split": body["share_split"],
    }


@router.get("/list/{artist_id}")
async def list_dlcs(artist_id: str) -> Dict[str, Any]:
    """Public: every minted DLC for an artist."""
    from utils.database import get_database
    db = get_database()
    cur = db.beat_dlc_mints.find({"artist_id": artist_id}, {"_id": 0}).sort("minted_at", -1).limit(50)
    rows: List[Dict[str, Any]] = []
    async for d in cur:
        rows.append(d)
    return {"artist_id": artist_id, "count": len(rows), "dlcs": rows}


@router.get("/mint-mode")
async def mint_mode() -> Dict[str, Any]:
    """Surface the current mint mode so the UI can banner-warn users
    when they're actually looking at a SIMULATED hash."""
    return {"mint_mode": MINT_MODE,
            "is_production": MINT_MODE == "PRODUCTION",
            "spec_doc": "GlobalVibez_Streamer_Revenue_Blueprint.pdf §3"}
