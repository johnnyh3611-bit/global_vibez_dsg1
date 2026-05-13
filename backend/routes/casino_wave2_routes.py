"""
Casino Wave-II routes — HTTP wiring for casino_wave2_engines.

All routes mounted under /api/games/* with a per-game prefix.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.casino_wave2_engines import (
    play_three_card_poker, THREE_CARD_PAIR_PLUS_PAYOUTS,
    play_pai_gow_simple,
    play_casino_war,
    play_chemin_de_fer,
    spin_european_roulette, settle_european_roulette,
    EU_ROULETTE_PAYOUTS, EU_ROULETTE_RED,
    play_hazard,
    play_chuck_a_luck,
    BIG_SIX_LAYOUT, spin_big_six, play_big_six,
    JACKS_OR_BETTER_PAYTABLE, deal_jacks_or_better,
    play_jacks_or_better,
    play_fan_tan,
    play_faro, RANKS,
    score_vibes_dart,
)


# ──────────────────────────────────────────────────────────────────────────
# 1. THREE CARD POKER
# ──────────────────────────────────────────────────────────────────────────
three_card_router = APIRouter(prefix="/games/three-card-poker", tags=["three-card-poker"])


class ThreeCardIn(BaseModel):
    ante: float = Field(..., gt=0)
    raise_play: bool
    pair_plus: float = 0.0
    seed: Optional[int] = None


@three_card_router.get("/constants")
def three_card_constants() -> Dict:
    return {
        "name": "Three Card Poker",
        "tagline": "Beat the dealer · Pair Plus side bet · Q-high qualifier",
        "pair_plus_payouts": THREE_CARD_PAIR_PLUS_PAYOUTS,
    }


@three_card_router.post("/play")
def three_card_play(req: ThreeCardIn) -> Dict:
    try:
        out = play_three_card_poker(
            ante=req.ante, raise_play=req.raise_play,
            pair_plus=req.pair_plus, seed=req.seed,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "player_hand": [{"rank": r, "suit": s} for r, s in out.player_hand],
        "dealer_hand": [{"rank": r, "suit": s} for r, s in out.dealer_hand],
        "player_category": out.player_category,
        "dealer_category": out.dealer_category,
        "dealer_qualifies": out.dealer_qualifies,
        "folded": out.folded,
        "ante_payout": out.ante_payout, "play_payout": out.play_payout,
        "pair_plus_payout": out.pair_plus_payout, "ante_bonus": out.ante_bonus,
        "gross": out.gross, "tax": out.tax, "net": out.net,
    }


# ──────────────────────────────────────────────────────────────────────────
# 2. PAI GOW
# ──────────────────────────────────────────────────────────────────────────
pai_gow_router = APIRouter(prefix="/games/pai-gow", tags=["pai-gow"])


class PaiGowIn(BaseModel):
    stake: float = Field(..., ge=50)
    seed: Optional[int] = None


@pai_gow_router.get("/constants")
def pai_gow_constants() -> Dict:
    return {"name": "Pai Gow", "tagline": "7-card high roll vs banker · 5% commission on win"}


@pai_gow_router.post("/play")
def pai_gow_play(req: PaiGowIn) -> Dict:
    try:
        return play_pai_gow_simple(stake=req.stake, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 3. CASINO WAR
# ──────────────────────────────────────────────────────────────────────────
casino_war_router = APIRouter(prefix="/games/casino-war", tags=["casino-war"])


class CasinoWarIn(BaseModel):
    stake: float = Field(..., ge=50)
    go_to_war: bool = False
    seed: Optional[int] = None


@casino_war_router.get("/constants")
def cw_constants() -> Dict:
    return {"name": "Casino War", "tagline": "1 card head-to-head · go to war on tie"}


@casino_war_router.post("/play")
def cw_play(req: CasinoWarIn) -> Dict:
    try:
        return play_casino_war(stake=req.stake, go_to_war=req.go_to_war, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 4. CHEMIN DE FER
# ──────────────────────────────────────────────────────────────────────────
chemin_router = APIRouter(prefix="/games/chemin-de-fer", tags=["chemin-de-fer"])


class CheminIn(BaseModel):
    bet_side: str
    stake: float = Field(..., ge=50)
    seed: Optional[int] = None


@chemin_router.get("/constants")
def chemin_constants() -> Dict:
    return {"name": "Chemin de Fer", "tagline": "Banker variant of baccarat · 5% banker commission · 8:1 tie"}


@chemin_router.post("/play")
def chemin_play(req: CheminIn) -> Dict:
    try:
        return play_chemin_de_fer(bet_side=req.bet_side, stake=req.stake, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 5. EUROPEAN ROULETTE
# ──────────────────────────────────────────────────────────────────────────
eu_roulette_router = APIRouter(prefix="/games/european-roulette", tags=["european-roulette"])


class EUSpinIn(BaseModel):
    bet_type: str
    bet_value: Optional[int] = None
    stake: float = Field(..., ge=50)
    seed: Optional[int] = None


@eu_roulette_router.get("/constants")
def eu_constants() -> Dict:
    return {
        "name": "European Roulette",
        "tagline": "Single-zero wheel · classic outside + inside bets",
        "payouts": EU_ROULETTE_PAYOUTS,
        "red_numbers": sorted(EU_ROULETTE_RED),
    }


@eu_roulette_router.post("/play")
def eu_play(req: EUSpinIn) -> Dict:
    try:
        landed = spin_european_roulette(seed=req.seed)
        return settle_european_roulette(req.bet_type, req.bet_value, req.stake, landed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 6. HAZARD
# ──────────────────────────────────────────────────────────────────────────
hazard_router = APIRouter(prefix="/games/hazard", tags=["hazard"])


class HazardIn(BaseModel):
    main: int
    stake: float = Field(..., ge=50)
    seed: Optional[int] = None


@hazard_router.get("/constants")
def hazard_constants() -> Dict:
    return {"name": "Hazard", "tagline": "17th-century English dice · pick a main 5..9"}


@hazard_router.post("/play")
def hazard_play(req: HazardIn) -> Dict:
    try:
        return play_hazard(main=req.main, stake=req.stake, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 7. CHUCK-A-LUCK
# ──────────────────────────────────────────────────────────────────────────
chuck_router = APIRouter(prefix="/games/chuck-a-luck", tags=["chuck-a-luck"])


class ChuckIn(BaseModel):
    picked_number: int
    stake: float = Field(..., ge=50)
    seed: Optional[int] = None


@chuck_router.get("/constants")
def chuck_constants() -> Dict:
    return {"name": "Chuck-A-Luck", "tagline": "3 dice · pick a number 1-6 · triple = 10:1"}


@chuck_router.post("/play")
def chuck_play(req: ChuckIn) -> Dict:
    try:
        return play_chuck_a_luck(picked_number=req.picked_number, stake=req.stake, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 8. BIG SIX WHEEL
# ──────────────────────────────────────────────────────────────────────────
big_six_router = APIRouter(prefix="/games/big-six-wheel", tags=["big-six-wheel"])


class BigSixIn(BaseModel):
    bet_label: str
    stake: float = Field(..., ge=50)
    seed: Optional[int] = None


@big_six_router.get("/constants")
def big_six_constants() -> Dict:
    return {
        "name": "Big Six Wheel",
        "tagline": "54-segment money wheel · Joker/Logo pay 40:1",
        "layout": [{"label": l, "ratio": r, "count": c} for l, r, c in BIG_SIX_LAYOUT],
    }


@big_six_router.post("/play")
def big_six_play(req: BigSixIn) -> Dict:
    try:
        return play_big_six(bet_label=req.bet_label, stake=req.stake, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 9. JACKS OR BETTER
# ──────────────────────────────────────────────────────────────────────────
jacks_router = APIRouter(prefix="/games/jacks-or-better", tags=["jacks-or-better"])


class JacksDealIn(BaseModel):
    seed: Optional[int] = None


class JacksDrawIn(BaseModel):
    initial: List[Dict[str, str]]
    hold_indices: List[int] = []
    stake: float = Field(..., ge=50)
    seed: Optional[int] = None


@jacks_router.get("/constants")
def jacks_constants() -> Dict:
    return {
        "name": "Jacks or Better",
        "tagline": "5-card draw video poker · Royal pays 800:1",
        "paytable": JACKS_OR_BETTER_PAYTABLE,
    }


@jacks_router.post("/deal")
def jacks_deal(req: JacksDealIn) -> Dict:
    cards = deal_jacks_or_better(seed=req.seed)
    return {"hand": [{"rank": r, "suit": s} for r, s in cards]}


@jacks_router.post("/draw")
def jacks_draw(req: JacksDrawIn) -> Dict:
    initial = [(c["rank"], c["suit"]) for c in req.initial]
    try:
        return play_jacks_or_better(initial, req.hold_indices, req.stake, req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 10. FAN-TAN
# ──────────────────────────────────────────────────────────────────────────
fan_tan_router = APIRouter(prefix="/games/fan-tan", tags=["fan-tan"])


class FanTanIn(BaseModel):
    pick: int
    stake: float = Field(..., ge=50)
    seed: Optional[int] = None


@fan_tan_router.get("/constants")
def fan_tan_constants() -> Dict:
    return {"name": "Fan-Tan", "tagline": "Chinese bean game · pick 1-4 · 3:1 minus 5%"}


@fan_tan_router.post("/play")
def fan_tan_play(req: FanTanIn) -> Dict:
    try:
        return play_fan_tan(pick=req.pick, stake=req.stake, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 11. FARO
# ──────────────────────────────────────────────────────────────────────────
faro_router = APIRouter(prefix="/games/faro", tags=["faro"])


class FaroIn(BaseModel):
    picked_rank: str
    stake: float = Field(..., ge=50)
    seed: Optional[int] = None


@faro_router.get("/constants")
def faro_constants() -> Dict:
    return {"name": "Faro", "tagline": "Vintage saloon card game · pick a rank · soda/hock", "ranks": list(RANKS)}


@faro_router.post("/play")
def faro_play(req: FaroIn) -> Dict:
    try:
        return play_faro(picked_rank=req.picked_rank, stake=req.stake, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# 12. VIBES DARTS
# ──────────────────────────────────────────────────────────────────────────
darts_router = APIRouter(prefix="/games/vibes-darts", tags=["vibes-darts"])


class DartsIn(BaseModel):
    distance_from_bullseye: float = Field(..., ge=0.0, le=1.0)
    stake: float = Field(..., ge=50)


@darts_router.get("/constants")
def darts_constants() -> Dict:
    return {
        "name": "Vibes Darts",
        "tagline": "Skill-based · bullseye 50:1, inner 10:1, outer 2:1",
    }


@darts_router.post("/throw")
def darts_throw(req: DartsIn) -> Dict:
    try:
        return score_vibes_dart(distance_from_bullseye=req.distance_from_bullseye, stake=req.stake)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


__all__ = [
    "three_card_router", "pai_gow_router", "casino_war_router", "chemin_router",
    "eu_roulette_router", "hazard_router", "chuck_router", "big_six_router",
    "jacks_router", "fan_tan_router", "faro_router", "darts_router",
]
