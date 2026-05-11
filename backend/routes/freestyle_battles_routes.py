"""Live Freestyle Battles — HTTP routes (v6.5 Phase 3).

Endpoints under /api/freestyle/*. In-memory registry for Phase 3,
DB persistence in Phase 4 alongside Memory Bank rollout.

2026-02 Content Rights wiring:
  When a producer uploads a beat WITH a real `audio_url` (master file),
  the upload routes through services.content_rights — metadata blocklist
  + fingerprint dedupe + DMCA queue + signed time-limited download URLs
  on every /use. Backwards compatible: beats without an audio_url stay
  in the legacy meter-only billing path.
"""
from __future__ import annotations

import os
import uuid
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from services.freestyle_battles import (
    Beat, settle_beat_use,
    FreestyleBattle, BattleRound, judge_round, conclude_battle,
    BattleBet, place_battle_bet, settle_battle_bets,
    draw_random_beat,
    BEAT_USE_PRICE, BEAT_PRODUCER_SHARE,
    PLATFORM_BETTING_CUT, RANDOM_BEAT_ODDS_BOOST,
)
from services import content_rights


freestyle_router = APIRouter(prefix="/freestyle", tags=["freestyle-battles"])

# Mongo handle for the content rights integration. Cheap to construct
# once at module load; reused across requests.
_db_client = AsyncIOMotorClient(os.environ.get("MONGO_URL"))
_db = _db_client[os.environ.get("DB_NAME", "global_vibez_dsg")]

# In-memory state — replace with Mongo in Phase 4
_BEAT_VAULT: Dict[str, Beat] = {}
_BATTLES: Dict[str, FreestyleBattle] = {}
_BATTLE_BETS: Dict[str, List[BattleBet]] = {}


# ──────────────────────────────────────────────────────────────────────────
# BEAT VAULT
# ──────────────────────────────────────────────────────────────────────────
class BeatUploadRequest(BaseModel):
    producer_id: str
    title: str
    bpm: int = Field(..., ge=40, le=260)
    genre: str
    # Content Rights wiring. When `audio_url` is supplied (real MP3
    # upload), we route through services.content_rights so the beat
    # gets fingerprinted, metadata-blocklisted, and registered for
    # signed-URL delivery. Leave empty for the legacy meter-only path.
    audio_url: Optional[str] = None
    preview_url: Optional[str] = None
    description: Optional[str] = ""


@freestyle_router.post("/beats/upload")
async def beat_upload(req: BeatUploadRequest) -> Dict:
    bid = str(uuid.uuid4())
    asset_id: Optional[str] = None

    # If the producer supplied a real master audio URL, route through
    # the Content Rights ledger (DMCA + signed downloads). Otherwise
    # keep the legacy in-memory meter path so existing test fixtures
    # and freestyle battle flows don't regress.
    if req.audio_url:
        blocked = content_rights.metadata_block_check(req.title, req.description or "", req.genre)
        if blocked:
            raise HTTPException(
                status_code=400,
                detail=f"Listing blocked: term '{blocked}' is on the IP protection blocklist.",
            )
        fingerprint = content_rights.compute_fingerprint(req.audio_url.encode("utf-8"))
        asset = await content_rights.register_asset(
            db=_db,
            seller_id=req.producer_id,
            title=req.title,
            description=req.description or "",
            fingerprint=fingerprint,
            master_url=req.audio_url,
            sample_url=req.preview_url,
            price_usd=BEAT_USE_PRICE,
            asset_type="beat",
        )
        asset_id = asset.get("asset_id")

    beat = Beat(
        beat_id=bid, producer_id=req.producer_id, title=req.title,
        bpm=req.bpm, genre=req.genre,
        audio_url=req.audio_url, preview_url=req.preview_url,
        asset_id=asset_id,
    )
    _BEAT_VAULT[bid] = beat
    return {
        "beat_id": bid, "producer_id": beat.producer_id,
        "title": beat.title, "bpm": beat.bpm, "genre": beat.genre,
        "is_active": beat.is_active, "use_count": beat.use_count,
        # Content Rights surfaces — empty when the beat is meter-only.
        "asset_id": beat.asset_id,
        "preview_url": beat.preview_url,
        "drm_protected": bool(beat.asset_id),
    }


@freestyle_router.get("/beats")
def beat_list() -> Dict:
    return {"beats": [
        {
            "beat_id": b.beat_id, "producer_id": b.producer_id,
            "title": b.title, "bpm": b.bpm, "genre": b.genre,
            "use_count": b.use_count, "is_active": b.is_active,
            # Public preview URL is safe to expose; master is not.
            "preview_url": b.preview_url,
            "drm_protected": bool(b.asset_id),
        } for b in _BEAT_VAULT.values()
    ]}


class BeatUseRequest(BaseModel):
    """Optional buyer_user_id — required when the beat is DRM-protected
    (has a content_rights asset) so we can mint a signed token tied to
    the buyer. Legacy meter-only beats accept anonymous use."""
    buyer_user_id: Optional[str] = None


@freestyle_router.post("/beats/{beat_id}/use")
async def beat_use(beat_id: str, req: Optional[BeatUseRequest] = None) -> Dict:
    beat = _BEAT_VAULT.get(beat_id)
    if not beat:
        raise HTTPException(status_code=404, detail="beat not found")
    try:
        out = settle_beat_use(beat)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # If this beat has a Content Rights asset, mint a signed download
    # URL on top of the existing payout payload. This is the path that
    # lights up the moment producers start uploading real MP3s.
    if beat.asset_id:
        buyer = (req.buyer_user_id if req else None) or "anonymous"
        try:
            purchase = await content_rights.record_purchase(
                db=_db, asset_id=beat.asset_id, buyer_user_id=buyer,
            )
            out["purchase_id"] = purchase.get("purchase_id")
            out["download_token"] = purchase.get("token")
            out["download_expires_at"] = purchase.get("expires_at")
            out["download_expires_in_seconds"] = purchase.get("expires_in_seconds")
            out["escrow_release_at"] = purchase.get("escrow_release_at")
            out["drm_protected"] = True
        except ValueError as e:
            # Asset was taken down or deactivated since upload.
            raise HTTPException(status_code=451, detail=str(e))
    else:
        out["drm_protected"] = False

    # bump use_count immutably by replacing the dataclass
    _BEAT_VAULT[beat_id] = Beat(
        beat_id=beat.beat_id, producer_id=beat.producer_id, title=beat.title,
        bpm=beat.bpm, genre=beat.genre, use_count=beat.use_count + 1,
        is_active=beat.is_active,
        audio_url=beat.audio_url, preview_url=beat.preview_url,
        asset_id=beat.asset_id,
    )
    return out


@freestyle_router.post("/beats/random")
def beat_random() -> Dict:
    try:
        beat = draw_random_beat(list(_BEAT_VAULT.values()))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "beat_id": beat.beat_id, "title": beat.title, "bpm": beat.bpm,
        "genre": beat.genre, "is_random_pick": True,
    }


@freestyle_router.get("/constants")
def freestyle_constants() -> Dict:
    return {
        "beat_use_price": BEAT_USE_PRICE,
        "beat_producer_share": BEAT_PRODUCER_SHARE,
        "platform_betting_cut": PLATFORM_BETTING_CUT,
        "random_beat_odds_boost": RANDOM_BEAT_ODDS_BOOST,
    }


# ──────────────────────────────────────────────────────────────────────────
# BATTLE
# ──────────────────────────────────────────────────────────────────────────
class BattleCreateRequest(BaseModel):
    artist_a_id: str
    artist_b_id: str


@freestyle_router.post("/battles/create")
def battle_create(req: BattleCreateRequest) -> Dict:
    if req.artist_a_id == req.artist_b_id:
        raise HTTPException(status_code=400, detail="artists must differ")
    bid = str(uuid.uuid4())
    battle = FreestyleBattle(battle_id=bid, artist_a_id=req.artist_a_id,
                             artist_b_id=req.artist_b_id)
    _BATTLES[bid] = battle
    _BATTLE_BETS[bid] = []
    return {
        "battle_id": bid,
        "artist_a_id": battle.artist_a_id,
        "artist_b_id": battle.artist_b_id,
        "status": battle.status,
    }


class AddRoundRequest(BaseModel):
    battle_id: str
    beat_id: str
    is_random_beat: bool = False


@freestyle_router.post("/battles/round")
def battle_add_round(req: AddRoundRequest) -> Dict:
    battle = _BATTLES.get(req.battle_id)
    if not battle:
        raise HTTPException(status_code=404, detail="battle not found")
    rd = battle.add_round(beat_id=req.beat_id, is_random_beat=req.is_random_beat)
    battle.status = "live"
    return {
        "battle_id": battle.battle_id, "round_number": rd.round_number,
        "beat_id": rd.beat_id, "is_random_beat": rd.is_random_beat,
    }


class JudgeRoundRequest(BaseModel):
    battle_id: str
    round_number: int
    score_a: int = Field(..., ge=0, le=100)
    score_b: int = Field(..., ge=0, le=100)


@freestyle_router.post("/battles/round/judge")
def battle_judge_round(req: JudgeRoundRequest) -> Dict:
    battle = _BATTLES.get(req.battle_id)
    if not battle:
        raise HTTPException(status_code=404, detail="battle not found")
    if not (1 <= req.round_number <= len(battle.rounds)):
        raise HTTPException(status_code=400, detail="round_number out of range")
    rd = judge_round(battle.rounds[req.round_number - 1], req.score_a, req.score_b)
    return {
        "battle_id": battle.battle_id, "round_number": rd.round_number,
        "winner": rd.winner, "score_a": rd.artist_a_score, "score_b": rd.artist_b_score,
    }


@freestyle_router.post("/battles/{battle_id}/conclude")
def battle_conclude(battle_id: str) -> Dict:
    battle = _BATTLES.get(battle_id)
    if not battle:
        raise HTTPException(status_code=404, detail="battle not found")
    return conclude_battle(battle)


# ──────────────────────────────────────────────────────────────────────────
# BETTING
# ──────────────────────────────────────────────────────────────────────────
class PlaceBetRequest(BaseModel):
    battle_id: str
    bettor_id: str
    on_artist: Literal["a", "b"]
    stake: float = Field(..., gt=0)


@freestyle_router.post("/bets/place")
def bet_place(req: PlaceBetRequest) -> Dict:
    if req.battle_id not in _BATTLES:
        raise HTTPException(status_code=404, detail="battle not found")
    bets = _BATTLE_BETS.setdefault(req.battle_id, [])
    try:
        bet = place_battle_bet(bets, req.bettor_id, req.on_artist, req.stake)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "battle_id": req.battle_id, "bettor_id": bet.bettor_id,
        "on_artist": bet.on_artist, "stake": bet.stake,
        "total_bets_placed": len(bets),
    }


class SettleBetsRequest(BaseModel):
    battle_id: str
    winning_artist: Literal["a", "b"]
    is_random_beat: bool = False


@freestyle_router.post("/bets/settle")
def bet_settle(req: SettleBetsRequest) -> Dict:
    bets = _BATTLE_BETS.get(req.battle_id, [])
    return settle_battle_bets(bets, req.winning_artist, req.is_random_beat)


__all__ = ["freestyle_router"]
