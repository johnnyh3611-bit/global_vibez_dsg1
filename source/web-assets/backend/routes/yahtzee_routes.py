"""
Yahtzee HTTP routes — thin layer over services/yahtzee.py.

Routes (prefix /api/games/yahtzee):
  GET  /constants           Game constants for the frontend
  POST /roll                Roll N dice (with optional held-dice indices)
  POST /score-roll          Compute scores across all categories for a roll
  POST /fill                Fill a category on a scorecard (returns new scorecard + totals)
  POST /totals              Compute totals for a scorecard
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import random

from services.yahtzee import (
    NUM_DICE, DICE_FACES, ALL_CATEGORIES, UPPER_CATEGORIES, LOWER_CATEGORIES,
    UPPER_BONUS_THRESHOLD, UPPER_BONUS_VALUE, YAHTZEE_BONUS_VALUE,
    score_category, Scorecard, fill_category as svc_fill, compute_totals,
    best_categories_for, is_yahtzee,
)


router = APIRouter(prefix="/games/yahtzee", tags=["yahtzee"])


# ── Models ──────────────────────────────────────────────────────────────────
class RollRequest(BaseModel):
    held: List[int] = Field(default_factory=list, description="0..4 indices of dice to keep")
    current_dice: Optional[List[int]] = Field(None, description="Current 5 dice (required if held provided)")
    seed: Optional[int] = None


class ScoreRollRequest(BaseModel):
    dice: List[int]
    scorecard: Optional[Dict[str, Optional[int]]] = None
    yahtzee_bonus_count: int = 0


class FillRequest(BaseModel):
    category: str
    dice: List[int]
    scorecard: Dict[str, Optional[int]]
    yahtzee_bonus_count: int = 0


class TotalsRequest(BaseModel):
    scorecard: Dict[str, Optional[int]]
    yahtzee_bonus_count: int = 0


# ── Helpers ─────────────────────────────────────────────────────────────────
def _sc_from_dict(d: Dict[str, Optional[int]], bonus: int) -> Scorecard:
    sc = Scorecard()
    for cat in ALL_CATEGORIES:
        if cat in d and d[cat] is not None:
            sc.categories[cat] = d[cat]
    sc.yahtzee_bonus_count = bonus
    return sc


def _sc_to_dict(sc: Scorecard) -> Dict:
    return {
        "categories": dict(sc.categories),
        "yahtzee_bonus_count": sc.yahtzee_bonus_count,
    }


# ── Routes ──────────────────────────────────────────────────────────────────
@router.get("/constants")
def get_constants() -> Dict:
    return {
        "num_dice":               NUM_DICE,
        "dice_faces":             list(DICE_FACES),
        "all_categories":         list(ALL_CATEGORIES),
        "upper_categories":       list(UPPER_CATEGORIES),
        "lower_categories":       list(LOWER_CATEGORIES),
        "upper_bonus_threshold":  UPPER_BONUS_THRESHOLD,
        "upper_bonus_value":      UPPER_BONUS_VALUE,
        "yahtzee_bonus_value":    YAHTZEE_BONUS_VALUE,
        "name":                   "Yahtzee",
        "tagline":                "Roll · Hold · Score · Repeat 13 times.",
    }


@router.post("/roll")
def roll_dice(req: RollRequest) -> Dict:
    """Roll 5 dice. If `held` indices + `current_dice` provided, keep those, re-roll the rest."""
    rng = random.Random(req.seed) if req.seed is not None else random.Random()

    if req.current_dice is None:
        new = [rng.randint(1, 6) for _ in range(NUM_DICE)]
    else:
        if len(req.current_dice) != NUM_DICE:
            raise HTTPException(status_code=400, detail=f"current_dice must have {NUM_DICE} values")
        held_set = set(req.held)
        for h in held_set:
            if h < 0 or h >= NUM_DICE:
                raise HTTPException(status_code=400, detail=f"held index {h} out of range")
        new = [
            req.current_dice[i] if i in held_set else rng.randint(1, 6)
            for i in range(NUM_DICE)
        ]

    return {
        "dice": new,
        "is_yahtzee": is_yahtzee(new),
    }


@router.post("/score-roll")
def score_roll(req: ScoreRollRequest) -> Dict:
    """Compute every category's potential score for a roll. Frontend uses this for UI hints."""
    if len(req.dice) != NUM_DICE:
        raise HTTPException(status_code=400, detail=f"dice must have {NUM_DICE} values")
    try:
        scorecard = _sc_from_dict(req.scorecard or {}, req.yahtzee_bonus_count)
        suggestions = best_categories_for(req.dice, scorecard)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "dice": req.dice,
        "is_yahtzee": is_yahtzee(req.dice),
        "scores": {cat: score for cat, score in suggestions},
        "ranked": [{"category": c, "score": s} for c, s in suggestions],
    }


@router.post("/fill")
def fill(req: FillRequest) -> Dict:
    """Apply a roll to a category and return the updated scorecard + totals."""
    sc = _sc_from_dict(req.scorecard, req.yahtzee_bonus_count)
    try:
        svc_fill(sc, req.category, req.dice)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    totals = compute_totals(sc)
    return {
        "scorecard": _sc_to_dict(sc),
        "totals": {
            "upper_subtotal":  totals.upper_subtotal,
            "upper_bonus":     totals.upper_bonus,
            "upper_total":     totals.upper_total,
            "lower_subtotal":  totals.lower_subtotal,
            "yahtzee_bonus":   totals.yahtzee_bonus,
            "grand_total":     totals.grand_total,
        },
        "is_complete": sc.is_complete(),
    }


@router.post("/totals")
def totals(req: TotalsRequest) -> Dict:
    sc = _sc_from_dict(req.scorecard, req.yahtzee_bonus_count)
    t = compute_totals(sc)
    return {
        "upper_subtotal":  t.upper_subtotal,
        "upper_bonus":     t.upper_bonus,
        "upper_total":     t.upper_total,
        "lower_subtotal":  t.lower_subtotal,
        "yahtzee_bonus":   t.yahtzee_bonus,
        "grand_total":     t.grand_total,
        "is_complete":     sc.is_complete(),
    }


__all__ = ["router"]
