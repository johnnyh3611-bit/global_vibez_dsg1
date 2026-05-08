"""
Consolidated routes for Volume III/IV/V founder-spec engines.

Exposes all engines built but not yet HTTP-wired:
  - Bingo            /api/games/bingo/*
  - Caribbean Stud   /api/games/caribbean-stud/*
  - Sic Bo           /api/games/sic-bo/*
  - Craps Props      /api/games/craps/*
  - Vibes Wheel      /api/games/vibes-wheel/*
  - Keno             /api/games/keno/*
  - Sovereign Gifting /api/gifts/*
  - Social Battle    /api/battle/*
"""
from __future__ import annotations

import random
from typing import Dict, List, Optional, Set
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.bingo import (
    generate_card, daub_card, evaluate_card, cell_index, number_letter,
    BingoCard, COLUMN_RANGES, COLUMN_LETTERS, FREE_CELL_INDEX, call_number,
)
from services.caribbean_stud import (
    Card as CSCard, deal_round, evaluate_hand, resolve_round,
    HAND_RANK_ORDER,
)
from services.coming_soon_engines import (
    sic_bo_payout, craps_prop_payout, vibes_wheel_spin_outcome, keno_payout,
    VIBES_WHEEL_SLOTS, SIC_BO_SPECIFIC_TRIPLE_PAYOUT,
    CRAPS_SNAKE_EYES_PAYOUT, CRAPS_BOXCARS_PAYOUT,
    KENO_PERFECT_HIT_PAYOUT, KENO_ZERO_HIT_REBATE,
)
from services.sovereign_gifting import (
    process_luxury_gift, lookup_gift_buff, GIFT_REGISTRY, VIBERIDEZ_GIFTS,
    GIFT_CREATOR_PCT, GIFT_TREASURY_PCT, GIFT_BURN_PCT,
)
from services.social_battle_engine import (
    split_battle_pot, apply_gas_gift, hybrid_score,
    NITRO_GIFT_VALUE_DSG, SHIELD_GIFT_VALUE_DSG,
    SOVEREIGN_CRATE_MIN_INTERVAL, SOVEREIGN_CRATE_MAX_INTERVAL,
    should_drop_sovereign_crate,
)


# ──────────────────────────────────────────────────────────────────────────
# BINGO
# ──────────────────────────────────────────────────────────────────────────
bingo_router = APIRouter(prefix="/games/bingo", tags=["bingo"])


class BingoCardOut(BaseModel):
    cells: List[List[int]]
    daubed: List[int]


class BingoEvaluateIn(BaseModel):
    cells: List[List[int]]
    daubed: List[int]
    stake: float = Field(..., gt=0)


class BingoDrawIn(BaseModel):
    already_called: List[int] = []
    seed: Optional[int] = None


@bingo_router.get("/constants")
def bingo_constants() -> Dict:
    return {
        "card_size": 5, "free_cell_index": FREE_CELL_INDEX,
        "column_ranges": [list(r) for r in COLUMN_RANGES],
        "column_letters": list(COLUMN_LETTERS),
    }


@bingo_router.post("/card/generate")
def bingo_generate(seed: Optional[int] = None) -> BingoCardOut:
    card = generate_card(seed=seed)
    return BingoCardOut(cells=card.cells, daubed=sorted(card.daubed))


@bingo_router.post("/draw")
def bingo_draw(req: BingoDrawIn) -> Dict:
    rng = random.Random(req.seed) if req.seed is not None else random.Random()
    try:
        n = call_number(rng, set(req.already_called))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"number": n, "letter": number_letter(n), "called": f"{number_letter(n)}-{n}"}


@bingo_router.post("/evaluate")
def bingo_evaluate(req: BingoEvaluateIn) -> Dict:
    card = BingoCard(cells=req.cells)
    card.daubed = set(req.daubed) | {FREE_CELL_INDEX}
    res = evaluate_card(card, stake=req.stake)
    return {
        "has_win": res.has_win, "patterns": res.patterns,
        "is_sovereign_square": res.is_sovereign_square,
        "base_multiplier": res.base_payout_multiplier,
        "final_multiplier": res.final_multiplier,
        "gross_payout": res.gross_payout,
        "sovereign_tax": res.sovereign_tax,
        "net_payout": res.net_payout,
    }


# ──────────────────────────────────────────────────────────────────────────
# CARIBBEAN STUD
# ──────────────────────────────────────────────────────────────────────────
cs_router = APIRouter(prefix="/games/caribbean-stud", tags=["caribbean-stud"])


class CSDealIn(BaseModel):
    seed: Optional[int] = None


class CSResolveIn(BaseModel):
    player_hand: List[Dict[str, str]]   # [{"rank": "A", "suit": "S"}, ...]
    dealer_hand: List[Dict[str, str]]
    ante: float = Field(..., gt=0)
    raise_play: bool


def _cards_from_dicts(arr: List[Dict[str, str]]) -> List[CSCard]:
    return [CSCard(rank=c["rank"], suit=c["suit"]) for c in arr]


@cs_router.get("/constants")
def cs_constants() -> Dict:
    from services.coming_soon_engines import CARIBBEAN_STUD_PAYOUT_TABLE
    return {
        "name": "Caribbean Stud Poker",
        "tagline": "5 cards vs dealer · A-K qualifier · Royal Flush 100:1",
        "payout_table": CARIBBEAN_STUD_PAYOUT_TABLE,
        "hand_rank_order": list(HAND_RANK_ORDER),
    }


@cs_router.post("/deal")
def cs_deal(req: CSDealIn) -> Dict:
    p, d = deal_round(seed=req.seed)
    return {
        "player_hand": [{"rank": c.rank, "suit": c.suit} for c in p],
        "dealer_hand": [{"rank": c.rank, "suit": c.suit} for c in d],
    }


@cs_router.post("/resolve")
def cs_resolve(req: CSResolveIn) -> Dict:
    try:
        p = _cards_from_dicts(req.player_hand)
        d = _cards_from_dicts(req.dealer_hand)
        out = resolve_round(p, d, ante=req.ante, raise_play=req.raise_play)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "player_category": out.player_category,
        "dealer_category": out.dealer_category,
        "dealer_qualifies": out.dealer_qualifies,
        "folded": out.folded,
        "ante": out.ante,
        "play_bet": out.play_bet,
        "ante_payout": out.ante_payout,
        "play_payout": out.play_payout,
        "gross_total": out.gross_total,
        "sovereign_tax": out.sovereign_tax,
        "net_total": out.net_total,
    }


# ──────────────────────────────────────────────────────────────────────────
# SIC BO
# ──────────────────────────────────────────────────────────────────────────
sicbo_router = APIRouter(prefix="/games/sic-bo", tags=["sic-bo"])


class SicBoIn(BaseModel):
    bet_type: str
    dice: List[int]
    stake: float = Field(..., gt=0)


@sicbo_router.get("/constants")
def sicbo_constants() -> Dict:
    return {
        "name": "Sic Bo",
        "specific_triple_payout": SIC_BO_SPECIFIC_TRIPLE_PAYOUT,
        "supported_bets": ["specific_triple_1..6", "any_triple"],
    }


@sicbo_router.post("/play")
def sicbo_play(req: SicBoIn) -> Dict:
    try:
        return sic_bo_payout(req.bet_type, req.dice, req.stake)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@sicbo_router.post("/roll")
def sicbo_roll(seed: Optional[int] = None) -> Dict:
    rng = random.Random(seed) if seed is not None else random.Random()
    return {"dice": [rng.randint(1, 6) for _ in range(3)]}


# ──────────────────────────────────────────────────────────────────────────
# CRAPS
# ──────────────────────────────────────────────────────────────────────────
craps_router = APIRouter(prefix="/games/craps", tags=["craps"])


class CrapsPropIn(BaseModel):
    prop: str             # "snake_eyes" | "boxcars"
    dice_roll: List[int]
    stake: float = Field(..., gt=0)


@craps_router.get("/constants")
def craps_constants() -> Dict:
    return {
        "name": "Craps Props",
        "snake_eyes_payout": CRAPS_SNAKE_EYES_PAYOUT,
        "boxcars_payout": CRAPS_BOXCARS_PAYOUT,
    }


@craps_router.post("/prop")
def craps_prop(req: CrapsPropIn) -> Dict:
    if len(req.dice_roll) != 2:
        raise HTTPException(status_code=400, detail="dice_roll must have 2 values")
    try:
        return craps_prop_payout(req.prop, (req.dice_roll[0], req.dice_roll[1]), req.stake)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# VIBES WHEEL
# ──────────────────────────────────────────────────────────────────────────
vw_router = APIRouter(prefix="/games/vibes-wheel", tags=["vibes-wheel"])


class VWSpinIn(BaseModel):
    stake: float = Field(..., gt=0)
    seed: Optional[int] = None


@vw_router.get("/constants")
def vw_constants() -> Dict:
    from services.coming_soon_engines import (
        VIBES_WHEEL_SOVEREIGN_JOKER_PAYOUT, VIBES_WHEEL_SOVEREIGN_JOKER_BURN_PCT,
    )
    return {
        "name": "Vibes Wheel",
        "slots": VIBES_WHEEL_SLOTS,
        "joker_payout": VIBES_WHEEL_SOVEREIGN_JOKER_PAYOUT,
        "joker_burn_pct": VIBES_WHEEL_SOVEREIGN_JOKER_BURN_PCT,
    }


@vw_router.post("/spin")
def vw_spin(req: VWSpinIn) -> Dict:
    rng = random.Random(req.seed) if req.seed is not None else random.Random()
    landed = rng.randint(0, VIBES_WHEEL_SLOTS - 1)
    try:
        return vibes_wheel_spin_outcome(landed_slot_index=landed, stake=req.stake)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────────────────
# KENO
# ──────────────────────────────────────────────────────────────────────────
keno_router = APIRouter(prefix="/games/keno", tags=["keno"])


class KenoPlayIn(BaseModel):
    picks: List[int] = Field(..., min_items=1, max_items=10)
    stake: float = Field(..., gt=0)
    seed: Optional[int] = None


@keno_router.get("/constants")
def keno_constants() -> Dict:
    return {
        "name": "Keno",
        "perfect_hit_payout": KENO_PERFECT_HIT_PAYOUT,
        "zero_hit_rebate": KENO_ZERO_HIT_REBATE,
        "max_picks": 10, "min_picks": 1,
        "draw_size": 20, "number_pool": 80,
    }


@keno_router.post("/play")
def keno_play(req: KenoPlayIn) -> Dict:
    if any(p < 1 or p > 80 for p in req.picks):
        raise HTTPException(status_code=400, detail="picks must be 1..80")
    if len(set(req.picks)) != len(req.picks):
        raise HTTPException(status_code=400, detail="picks must be unique")
    rng = random.Random(req.seed) if req.seed is not None else random.Random()
    drawn: Set[int] = set(rng.sample(range(1, 81), 20))
    hits = len(set(req.picks) & drawn)
    try:
        result = keno_payout(picks=len(req.picks), hits=hits, stake=req.stake)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "picks": sorted(req.picks),
        "drawn": sorted(drawn),
        "hits": hits,
        "stake": req.stake,
        "multiplier": result["multiplier"],
        "gross": result["gross"],
        "tax": result["tax"],
        "net": result["net"],
    }


# ──────────────────────────────────────────────────────────────────────────
# SOVEREIGN GIFTING (Volume III)
# ──────────────────────────────────────────────────────────────────────────
gifts_router = APIRouter(prefix="/gifts", tags=["gifts"])


class GiftPurchaseIn(BaseModel):
    item_id: str
    price: float = Field(..., gt=0)
    buyer_id: str
    recipient_id: str


@gifts_router.get("/list")
def gifts_list() -> Dict:
    return {
        "split": {
            "creator": GIFT_CREATOR_PCT,
            "treasury": GIFT_TREASURY_PCT,
            "burn": GIFT_BURN_PCT,
        },
        "gifts": [
            {
                "item_id": k,
                "name": v.name,
                "visual_effect": v.visual_effect,
                "boost_type": v.boost_type,
                "boost_value": v.boost_value,
                "duration_minutes": v.duration_minutes,
                "rebate_count": v.rebate_count,
            }
            for k, v in GIFT_REGISTRY.items()
        ],
        "viberidez_gifts": [
            {"item_id": k, "name": v.name, "visual": v.visual,
             "performance": v.performance, "haptic": v.haptic}
            for k, v in VIBERIDEZ_GIFTS.items()
        ],
    }


@gifts_router.post("/purchase")
def gifts_purchase(req: GiftPurchaseIn) -> Dict:
    try:
        s = process_luxury_gift(req.item_id, req.price, req.buyer_id, req.recipient_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    buff = lookup_gift_buff(req.item_id)
    return {
        "item_id": s.item_id, "buyer_id": s.buyer_id, "recipient_id": s.recipient_id,
        "price": s.price,
        "creator_share": s.creator_share,
        "treasury_share": s.treasury_share,
        "burn_share": s.burn_share,
        "buff": (
            None if buff is None
            else {"name": buff.name, "boost_type": buff.boost_type,
                  "boost_value": buff.boost_value, "duration_minutes": buff.duration_minutes,
                  "rebate_count": buff.rebate_count}
        ),
    }


# ──────────────────────────────────────────────────────────────────────────
# SOCIAL BATTLE (Volume V)
# ──────────────────────────────────────────────────────────────────────────
battle_router = APIRouter(prefix="/battle", tags=["battle"])


class BattlePotIn(BaseModel):
    gift_total: float = Field(..., ge=0)
    seat_fees: float = Field(0, ge=0)


class GasGiftIn(BaseModel):
    gift_type: str   # "nitro" | "shield"


class HybridScoreIn(BaseModel):
    heat_score: float = Field(..., ge=0)
    mining_score: float = Field(..., ge=0)


@battle_router.get("/constants")
def battle_constants() -> Dict:
    return {
        "nitro_cost_dsg": NITRO_GIFT_VALUE_DSG,
        "shield_cost_dsg": SHIELD_GIFT_VALUE_DSG,
        "sovereign_crate_min_interval": SOVEREIGN_CRATE_MIN_INTERVAL,
        "sovereign_crate_max_interval": SOVEREIGN_CRATE_MAX_INTERVAL,
    }


@battle_router.post("/split-pot")
def battle_split(req: BattlePotIn) -> Dict:
    s = split_battle_pot(req.gift_total, req.seat_fees)
    return {
        "gift_total": s.gift_total, "seat_fees": s.seat_fees,
        "total_pot": s.total_pot, "sovereign_tax": s.sovereign_tax,
        "net_pot": s.net_pot, "streamer_share": s.streamer_share,
        "platform_share": s.platform_share,
    }


@battle_router.post("/gas-gift")
def battle_gas(req: GasGiftIn) -> Dict:
    try:
        e = apply_gas_gift(req.gift_type)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "gift_type": e.gift_type, "cost_dsg": e.cost_dsg,
        "multiplier_added": e.multiplier_added,
        "debuffs_blocked": e.debuffs_blocked,
    }


@battle_router.post("/hybrid-score")
def battle_hybrid(req: HybridScoreIn) -> Dict:
    return {"score": hybrid_score(req.heat_score, req.mining_score)}


__all__ = [
    "bingo_router", "cs_router", "sicbo_router", "craps_router",
    "vw_router", "keno_router", "gifts_router", "battle_router",
]
