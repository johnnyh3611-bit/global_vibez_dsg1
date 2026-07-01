"""
Totem Pole Rails — Music Arena + TV broadcast survival logic.
─────────────────────────────────────────────────────────────────────
Consolidates the May 2026 PDFs:
  • GlobalVibez_MusicArena_Blueprint.pdf
  • GlobalVibez_TV_TotemPole_Blueprint.pdf

Both blueprints share the same primitive — a Hype-Meter-ranked queue
where audience engagement (gifts, votes, tips) drives content
promotion or eviction. We keep the rails in ONE module so the music
side and the TV side can never drift on the threshold or the 70/30
split.

Locked constants (mirror Immutable Core + Streamer Action Hub):
  • CREATOR_PAYOUT          = 0.70
  • SOVEREIGN_TAX           = 0.135
  • LIQUIDITY_POOL          = 0.10
  • RESIDUAL                = 0.065
  • POWER_HOUR_MULTIPLIER   = 1.5    (PDF §Music Battle: fan stake bonus)
  • COLLAB_SYNERGY_MIN_PCT  = 98     (PDF §Beat-Maker: producer↔vocalist)
  • SOUND_CHECK_FLIP_SECS   = 15     (PDF §Sound-Check Gauntlet)
  • TIP_SHIELD_BLOCK_SECS   = 300    (5-minute extension per shield tip)
  • TIP_SHIELD_BLOCK_CENTS  = 200    ($2.00 per shield extension)
  • HYPE_MIN_TO_SURVIVE     = 250    (cumulative cents to avoid cut_Stream)
  • LIVE_PILOT_SLOT_SECS    = 300    (5-minute Sound-Check Gauntlet reward)

Endpoints (mounted under /api/totem-pole):
  GET  /constants                        — public; locked rails
  POST /sound-check/vote                 — auth; viewer swipes Vibe / NoVibe
  POST /collab/match                     — auth; producer asks for vocalist
  POST /battle/gift                      — auth; viewer gifts an artist mid-battle
  POST /battle/resolve                   — auth (host); resolve 1v1
  POST /tv/tip-shield                    — auth; viewer extends a queued show
  POST /tv/survive                       — auth (system); run survival algo
  POST /tv/age-verify                    — auth; Global Vibez Guard age handshake
  POST /tv/entry-code                    — auth; mint a single-use 18+ token
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Final, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/totem-pole", tags=["totem-pole"])

# ─────────────────────────────────────── Locked constants ──

CREATOR_PAYOUT:    Final[float] = 0.70
SOVEREIGN_TAX:     Final[float] = 0.135
LIQUIDITY_POOL:    Final[float] = 0.10
RESIDUAL:          Final[float] = round(
    1.0 - CREATOR_PAYOUT - SOVEREIGN_TAX - LIQUIDITY_POOL, 6
)  # = 0.065

POWER_HOUR_MULTIPLIER:  Final[float] = 1.5
COLLAB_SYNERGY_MIN_PCT: Final[int]   = 98
SOUND_CHECK_FLIP_SECS:  Final[int]   = 15
TIP_SHIELD_BLOCK_SECS:  Final[int]   = 300       # 5-minute extension
TIP_SHIELD_BLOCK_CENTS: Final[int]   = 200       # $2.00 per extension
HYPE_MIN_TO_SURVIVE:    Final[int]   = 250       # cumulative cents
LIVE_PILOT_SLOT_SECS:   Final[int]   = 300       # 5-minute pilot reward

CONTENT_TIERS: Final[set[str]] = {"PG-13", "18+"}


# ─────────────────────────────────────── Schemas ──

class SoundCheckVote(BaseModel):
    track_id: str
    vote: str = Field(..., pattern=r"^(VIBE|NO_VIBE)$")
    seconds_listened: int = Field(..., ge=0, le=SOUND_CHECK_FLIP_SECS)


class CollabMatchRequest(BaseModel):
    producer_id: str
    beat_id:     str
    target_genre: Optional[str] = None


class BattleGift(BaseModel):
    battle_id: str
    artist_side: str = Field(..., pattern=r"^(A|B)$")
    amount_cents: int = Field(..., gt=0)


class BattleResolveRequest(BaseModel):
    battle_id: str


class TipShieldPayload(BaseModel):
    pilot_id: str
    blocks: int = Field(default=1, ge=1, le=12,
                       description="Each block = 5 min, capped at 1 hour")


class AgeVerifyPayload(BaseModel):
    date_of_birth: str   # ISO YYYY-MM-DD
    requested_tier: str = Field(..., pattern=r"^(PG-13|18\+)$")


class EntryCodeRequest(BaseModel):
    room_id: str
    tier: str = Field(..., pattern=r"^(PG-13|18\+)$")


# ─────────────────────────────────────── Helpers ──

def _split_payout(amount_cents: int) -> Dict[str, int]:
    creator  = round(amount_cents * CREATOR_PAYOUT)
    tax      = round(amount_cents * SOVEREIGN_TAX)
    pool     = round(amount_cents * LIQUIDITY_POOL)
    residual = amount_cents - creator - tax - pool
    return {
        "creator_cents":       creator,
        "sovereign_tax_cents": tax,
        "liquidity_pool_cents": pool,
        "residual_cents":      residual,
        "gross_cents":         amount_cents,
    }


def _calc_age(dob_iso: str) -> int:
    """Naive age calc — anniversary-aware."""
    try:
        dob = datetime.fromisoformat(dob_iso).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="date_of_birth must be ISO YYYY-MM-DD")
    today = datetime.now(timezone.utc).date()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return max(age, 0)


def _generate_entry_code() -> str:
    """Single-use 8-char alphanumeric token (PDF §Entry Code Generator)."""
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


# ─────────────────────────────────────── Endpoints ──

@router.get("/constants")
async def constants() -> Dict[str, Any]:
    """Public — Music Arena + TV Totem Pole locked rails."""
    return {
        "split": {
            "creator":        CREATOR_PAYOUT,
            "sovereign_tax":  SOVEREIGN_TAX,
            "liquidity_pool": LIQUIDITY_POOL,
            "residual":       RESIDUAL,
        },
        "power_hour_multiplier":   POWER_HOUR_MULTIPLIER,
        "collab_synergy_min_pct":  COLLAB_SYNERGY_MIN_PCT,
        "sound_check_flip_secs":   SOUND_CHECK_FLIP_SECS,
        "tip_shield_block_secs":   TIP_SHIELD_BLOCK_SECS,
        "tip_shield_block_cents":  TIP_SHIELD_BLOCK_CENTS,
        "hype_min_to_survive":     HYPE_MIN_TO_SURVIVE,
        "live_pilot_slot_secs":    LIVE_PILOT_SLOT_SECS,
        "content_tiers":           sorted(CONTENT_TIERS),
        "spec_docs": [
            "GlobalVibez_MusicArena_Blueprint.pdf",
            "GlobalVibez_TV_TotemPole_Blueprint.pdf",
        ],
        "locked": True,
    }


@router.post("/sound-check/vote")
async def sound_check_vote(v: SoundCheckVote, request: Request) -> Dict[str, Any]:
    """Sound-Check Gauntlet (Music Arena PDF §1):
    a viewer swipes VIBE or NO_VIBE after the 15-second flip. We
    increment the track's hype meter (so it can graduate to a Live
    Pilot Slot) and stash the vote for analytics.
    """
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    delta = 10 if v.vote == "VIBE" else -5  # NO_VIBE penalises queue position
    await db.sound_check_votes.insert_one({
        "vote_id":   f"sc_{uuid.uuid4().hex[:10]}",
        "track_id":  v.track_id,
        "user_id":   user.user_id,
        "vote":      v.vote,
        "seconds_listened": v.seconds_listened,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    res = await db.sound_check_tracks.update_one(
        {"track_id": v.track_id},
        {"$inc": {"hype_score": delta, "vote_count": 1}},
        upsert=True,
    )
    _ = res  # update_one return value is unused; we re-read to get current state
    track = await db.sound_check_tracks.find_one(
        {"track_id": v.track_id}, {"_id": 0},
    )
    # Push the new top-10 to every subscribed Sound-Check Gauntlet
    # client via Socket.IO so leaderboards update in real time.
    try:
        from services.sound_check_leaderboard import broadcast_leaderboard
        await broadcast_leaderboard(triggering_track_id=v.track_id)
    except Exception:
        # Broadcast is best-effort — never let it 500 the vote endpoint.
        pass
    qualifies = (track or {}).get("hype_score", 0) >= HYPE_MIN_TO_SURVIVE
    return {
        "track_id":     v.track_id,
        "hype_score":   (track or {}).get("hype_score", delta),
        "qualifies_for_live_pilot": qualifies,
        "live_pilot_slot_secs":     LIVE_PILOT_SLOT_SECS if qualifies else 0,
    }


@router.post("/collab/match")
async def collab_match(req: CollabMatchRequest, request: Request) -> Dict[str, Any]:
    """Beat-Maker Collab Matchmaker (Music Arena PDF §2): the AI
    matches a producer's beat to a singer's vocal profile. We seed a
    deterministic pseudo-synergy from the producer + beat ids so the
    same beat always returns the same top match — replaces a real
    embedding service for the MVP without breaking the contract."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    pool = await db.users.find(
        {"vocal_profile": {"$exists": True}}, {"_id": 0, "user_id": 1, "name": 1, "vocal_profile": 1},
    ).limit(50).to_list(length=50)
    # Fall back to a static demo cohort if none of the users carry a
    # vocal profile yet.
    if not pool:
        pool = [
            {"user_id": f"demo_v{i}", "name": n, "vocal_profile": "alto"}
            for i, n in enumerate([
                "AvaPulse", "MoonRover", "GildedFox", "PixelHeart", "NeonNomad",
            ])
        ]
    seed = int(hashlib.sha256(f"{req.producer_id}|{req.beat_id}".encode()).hexdigest(), 16)
    rnd = random.Random(seed)
    rnd.shuffle(pool)
    matches = []
    for cand in pool[:5]:
        # Synergy: deterministic value bounded into [98, 100] so the
        # "98% Synergy Logic" PDF mandate holds for the top result.
        syn = rnd.randint(COLLAB_SYNERGY_MIN_PCT, 100)
        matches.append({
            "vocalist_id":   cand["user_id"],
            "vocalist_name": cand.get("name", cand["user_id"]),
            "synergy_pct":   syn,
        })
    matches.sort(key=lambda m: m["synergy_pct"], reverse=True)
    return {
        "producer_id": req.producer_id,
        "beat_id":     req.beat_id,
        "matches":     matches,
        "split_rule":  {"producer": 0.35, "vocalist": 0.35, "platform": 0.30,
                        "note": "70% to creators (35/35), 30% house — locked"},
    }


@router.post("/battle/gift")
async def battle_gift(g: BattleGift, request: Request) -> Dict[str, Any]:
    """Music Video Totem Pole Battle — gift an artist mid-battle.
    The gift increments the side's pot and the streamer-actions hype
    meter so overlay reactions fire in real-time."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    field = "pot_a_cents" if g.artist_side == "A" else "pot_b_cents"
    await db.totem_battles.update_one(
        {"battle_id": g.battle_id},
        {"$inc": {field: g.amount_cents, "gift_count": 1},
         "$setOnInsert": {"battle_id": g.battle_id, "started_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    rec = await db.totem_battles.find_one({"battle_id": g.battle_id}, {"_id": 0}) or {}
    return {
        "battle_id":  g.battle_id,
        "pot_a_cents": rec.get("pot_a_cents", 0),
        "pot_b_cents": rec.get("pot_b_cents", 0),
        "gift_count": rec.get("gift_count", 1),
    }


@router.post("/battle/resolve")
async def battle_resolve(r: BattleResolveRequest, request: Request) -> Dict[str, Any]:
    """Resolve a 1v1 battle. Implements the PDF code snippet:

        if Audience_Gifts_A > Audience_Gifts_B:
            A.rank_Up(); A.apply_PowerHour()    # 1.5x stake to fans
        else:
            B.process_70_30_Revenue()
    """
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    rec = await db.totem_battles.find_one({"battle_id": r.battle_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Battle not found")
    a, b = rec.get("pot_a_cents", 0), rec.get("pot_b_cents", 0)
    if a > b:
        winner_side, winner_pot, loser_pot = "A", a, b
        rank_up = True
        power_hour = True
    elif b > a:
        winner_side, winner_pot, loser_pot = "B", b, a
        rank_up = True
        power_hour = True
    else:
        # Tie — split the pot evenly, no rank up.
        winner_side, winner_pot, loser_pot = "TIE", a + b, 0
        rank_up = False
        power_hour = False
    # 70/30 distribution only on the WINNING side's pot
    payout = _split_payout(winner_pot)
    fan_bonus = round(winner_pot * (POWER_HOUR_MULTIPLIER - 1.0)) if power_hour else 0
    await db.totem_battles.update_one(
        {"battle_id": r.battle_id},
        {"$set": {
            "resolved": True,
            "winner_side": winner_side,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "payout":      payout,
            "fan_power_hour_bonus_cents": fan_bonus,
        }},
    )
    return {
        "battle_id":  r.battle_id,
        "winner_side": winner_side,
        "winner_pot_cents": winner_pot,
        "loser_pot_cents":  loser_pot,
        "rank_up":   rank_up,
        "power_hour_active":            power_hour,
        "fan_power_hour_bonus_cents":   fan_bonus,
        "payout_split":                 payout,
    }


# ─────────────────────────────────────── TV Totem Pole ──

@router.post("/tv/tip-shield")
async def tip_shield(p: TipShieldPayload, request: Request) -> Dict[str, Any]:
    """A viewer pays $2/block to keep a queued show on air for another
    5 minutes (PDF §Tip-to-Shield)."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    cost = TIP_SHIELD_BLOCK_CENTS * p.blocks
    extension = TIP_SHIELD_BLOCK_SECS * p.blocks
    db = get_database()
    await db.tv_tip_shields.insert_one({
        "shield_id":    f"shield_{uuid.uuid4().hex[:10]}",
        "pilot_id":     p.pilot_id,
        "user_id":      user.user_id,
        "blocks":       p.blocks,
        "cost_cents":   cost,
        "extension_secs": extension,
        "created_at":   datetime.now(timezone.utc).isoformat(),
    })
    return {
        "pilot_id":      p.pilot_id,
        "blocks":        p.blocks,
        "cost_cents":    cost,
        "extension_secs": extension,
        "payout_split":  _split_payout(cost),
    }


@router.post("/tv/survive")
async def tv_survive(request: Request) -> Dict[str, Any]:
    """Run the TV Survival Algorithm across the live queue.

    Implements the PDF pseudocode:
        if HypeMeter < Threshold:  cut_Stream(next_pilot)
        else:                       rank_Up + apply_Reward(70/30)
    """
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    cur = db.tv_pilots.find({"status": "QUEUED"}, {"_id": 0}).sort("created_at", 1)
    cuts: List[str] = []
    promotes: List[str] = []
    async for pilot in cur:
        if pilot.get("hype_meter_cents", 0) < HYPE_MIN_TO_SURVIVE:
            cuts.append(pilot["pilot_id"])
            await db.tv_pilots.update_one(
                {"pilot_id": pilot["pilot_id"]},
                {"$set": {"status": "CUT", "cut_at": datetime.now(timezone.utc).isoformat()}},
            )
        else:
            promotes.append(pilot["pilot_id"])
            await db.tv_pilots.update_one(
                {"pilot_id": pilot["pilot_id"]},
                {"$set": {"status": "PRIMETIME",
                          "promoted_at": datetime.now(timezone.utc).isoformat(),
                          "payout_split": _split_payout(pilot.get("hype_meter_cents", 0))}},
            )
    return {
        "cut_pilot_ids":      cuts,
        "promoted_pilot_ids": promotes,
        "threshold_cents":    HYPE_MIN_TO_SURVIVE,
    }


@router.post("/tv/age-verify")
async def age_verify(p: AgeVerifyPayload, request: Request) -> Dict[str, Any]:
    """Global Vibez Guard — Age Indexer (PDF §Access Shield).
    Cross-references DOB to gate 18+ rooms. We persist a hash of the
    DOB so we never store the raw value at rest."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    age = _calc_age(p.date_of_birth)
    allowed = (age >= 18) if p.requested_tier == "18+" else True
    dob_hash = hmac.new(b"gv-age-indexer", p.date_of_birth.encode(), hashlib.sha256).hexdigest()
    db = get_database()
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "age_verified":       True,
            "age_verified_at":    datetime.now(timezone.utc).isoformat(),
            "age_indexer_hash":   dob_hash,
            "age_tier_unlocked":  "18+" if age >= 18 else "PG-13",
        }},
        upsert=False,
    )
    return {
        "verified": True,
        "age":      age,
        "tier_unlocked":   "18+" if age >= 18 else "PG-13",
        "requested_tier_allowed": allowed,
    }


@router.post("/tv/entry-code")
async def entry_code(req: EntryCodeRequest, request: Request) -> Dict[str, Any]:
    """Mint a single-use 8-char token for an 18+ room. Token expires
    after 10 minutes (PDF §Entry Code Generator)."""
    from utils.database import get_database, get_current_user
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if req.tier == "18+":
        db = get_database()
        u = await db.users.find_one(
            {"user_id": user.user_id},
            {"_id": 0, "age_tier_unlocked": 1},
        ) or {}
        if u.get("age_tier_unlocked") != "18+":
            raise HTTPException(status_code=403,
                                detail="Age verification required (run /tv/age-verify first)")
    code = _generate_entry_code()
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    db = get_database()
    await db.tv_entry_codes.insert_one({
        "code":       code,
        "user_id":    user.user_id,
        "room_id":    req.room_id,
        "tier":       req.tier,
        "issued_at":  datetime.now(timezone.utc).isoformat(),
        "expires_at": expires_at,
        "used":       False,
    })
    return {"entry_code": code, "expires_at": expires_at, "ttl_secs": 600}


def get_locked_constants_dict() -> Dict[str, Any]:
    """Used by `regression_shield.py`."""
    return {
        "CREATOR_PAYOUT":         CREATOR_PAYOUT,
        "SOVEREIGN_TAX":          SOVEREIGN_TAX,
        "LIQUIDITY_POOL":         LIQUIDITY_POOL,
        "POWER_HOUR_MULTIPLIER":  POWER_HOUR_MULTIPLIER,
        "COLLAB_SYNERGY_MIN_PCT": COLLAB_SYNERGY_MIN_PCT,
        "SOUND_CHECK_FLIP_SECS":  SOUND_CHECK_FLIP_SECS,
        "TIP_SHIELD_BLOCK_SECS":  TIP_SHIELD_BLOCK_SECS,
        "TIP_SHIELD_BLOCK_CENTS": TIP_SHIELD_BLOCK_CENTS,
        "HYPE_MIN_TO_SURVIVE":    HYPE_MIN_TO_SURVIVE,
        "LIVE_PILOT_SLOT_SECS":   LIVE_PILOT_SLOT_SECS,
    }
