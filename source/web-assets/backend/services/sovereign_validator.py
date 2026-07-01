"""
Sovereign Game Logic Validator — v1.0
Implements `Global_Vibez_Sovereign_Game_Logic_Fix.pdf` (uploaded 2026-02-06).

Fix directives from the PDF:
  A. Bid Whist joker recognition via **Power Indexing** (not face value).
     Big Joker = 100, Little Joker = 90; they are ALWAYS the top two cards
     whenever a trump is declared (Uptown or Downtown).
  B. **15-second Turn Timer** watchdog → returns "FORCE_AUTO_PLAY" to the
     caller so the game loop can auto-play the lowest card.
  C. Spades / Hearts scoring integrity (verified against existing
     `utils/spades_game.py` + `utils/hearts_game.py` implementations).
  D. Broadcast the Trump Suit + Rank Mode each hand (this module exposes
     `hand_broadcast_payload()` that routes emit on `hand_start`).
  E. 13.5% Sovereign Tax must be deducted BEFORE the win animation —
     expose `apply_sovereign_tax()` so payout handlers call it ahead of
     the WS emit.

Pure functions — no DB, no network. Safe to import from any route/service.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

# ── A. Power Indexing table (PDF directive) ──────────────────────────────
# Joker power is DIRECTION-INDEPENDENT: Big > Little > everything else
# whenever a trump exists. In No-Trump (NT) play the PDF leaves jokers
# inert; we keep our codebase's prior behaviour of excluding them.
BIG_JOKER_POWER = 100
LITTLE_JOKER_POWER = 90

# Canonical non-joker rank ladder used when trump is declared.
_UPTOWN_RANK = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
    "9": 9, "10": 10, "J": 11, "Q": 12, "K": 13, "A": 14,
}
# Downtown per Midwest rules: 2 is highest, Ace holds as the *highest "low"*
# (2 wins over A under Downtown). Keep Ace above K but below 2.
_DOWNTOWN_RANK = {
    "2": 14, "3": 13, "4": 12, "5": 11, "6": 10, "7": 9, "8": 8,
    "9": 7, "10": 6, "J": 5, "Q": 4, "K": 3, "A": 2,
}


def _card_suit(card: Dict[str, Any]) -> str:
    return str(card.get("suit", "")).lower()


def _card_value_key(card: Dict[str, Any]) -> str:
    """Return the canonical rank key string ("A","K",...,"2") from a card
    dict. Accepts numeric legacy values (2..14) as well."""
    v = card.get("value", card.get("rank"))
    if isinstance(v, (int, float)):
        m = {14: "A", 13: "K", 12: "Q", 11: "J"}
        return m.get(int(v), str(int(v)))
    return str(v).upper()


def is_joker(card: Dict[str, Any]) -> bool:
    if _card_suit(card) == "joker":
        return True
    key = _card_value_key(card)
    # Some decks mark jokers as value="BIG_JOKER"/"LITTLE_JOKER".
    return key in {"BIG_JOKER", "LITTLE_JOKER", "J1", "J2"}


def _joker_kind(card: Dict[str, Any]) -> Optional[str]:
    """Return 'big' | 'little' | None for a joker card."""
    if not is_joker(card):
        return None
    cid = str(card.get("id", "")).lower()
    key = _card_value_key(card)
    if "big" in cid or key in {"BIG_JOKER", "J1"}:
        return "big"
    if "little" in cid or key in {"LITTLE_JOKER", "J2"}:
        return "little"
    # Fallback: numeric value > 14 → big.
    v = card.get("value", 0)
    if isinstance(v, (int, float)) and v >= 100:
        return "big"
    return "little"


def get_power(
    card: Dict[str, Any],
    trump_suit: Optional[str],
    led_suit: Optional[str] = None,
    bid_direction: str = "uptown",
    is_no_trump: bool = False,
) -> int:
    """Return the trick-resolution power of a card.

    • Jokers dominate whenever trump is in play (per PDF). Under NT they
      are inert (cannot be a trump) and only win if they happen to be led
      — we give them sub-card power so they lose to any suit card.
    • Trump beats non-trump.
    • Off-suit, non-trump cards cannot win → power = -1.
    """
    direction = (bid_direction or "uptown").lower()
    rank_table = _DOWNTOWN_RANK if direction == "downtown" else _UPTOWN_RANK

    jk = _joker_kind(card)
    if jk is not None:
        if is_no_trump:
            return -1  # Jokers inert in NT.
        return BIG_JOKER_POWER if jk == "big" else LITTLE_JOKER_POWER

    suit = _card_suit(card)
    key = _card_value_key(card)
    base = rank_table.get(key, 0)

    if trump_suit and suit == str(trump_suit).lower():
        return 50 + base  # Trump stratum beats all non-trump cards.
    if led_suit and suit == str(led_suit).lower():
        return base        # Led suit — vanilla rank race.
    return -1              # Off-suit, non-trump → can't win.


def calculate_winner(
    trick: List[Dict[str, Any]],
    trump_suit: Optional[str],
    led_suit: Optional[str] = None,
    bid_direction: str = "uptown",
    is_no_trump: bool = False,
) -> Optional[Dict[str, Any]]:
    """Return the winning play dict. `trick` is a list of `{card, player}`
    (or plays with `suit`/`value` at the top level — both shapes work)."""
    if not trick:
        return None
    if led_suit is None:
        first = trick[0]
        led_suit = _card_suit(first.get("card") or first)

    best = None
    best_power = -999
    for play in trick:
        card = play.get("card") or play
        p = get_power(card, trump_suit, led_suit, bid_direction, is_no_trump)
        if p > best_power:
            best_power = p
            best = play
    return best


# ── B. 15-second Turn Timer watchdog ─────────────────────────────────────
TURN_TIMER_MS = 15_000


def validate_turn_time(start_ms: int, max_limit_ms: int = TURN_TIMER_MS) -> str:
    """PDF-spec watchdog. `start_ms` is the epoch-ms the turn began.
    Returns "FORCE_AUTO_PLAY" if the limit is exceeded, else "TIME_OK"."""
    import time  # noqa: PLC0415
    elapsed = int(time.time() * 1000) - int(start_ms)
    return "FORCE_AUTO_PLAY" if elapsed > max_limit_ms else "TIME_OK"


# ── C. Spades / Hearts verified-score helpers (PDF sanity check) ────────
def verify_spades_score(
    bid: int,
    tricks_taken: int,
    current_bags: int = 0,
) -> int:
    """PDF formula:
       if tricks_taken < bid: return -(bid * 10)    # penalty
       else: score = (bid * 10) + (tricks_taken - bid)
             if current_bags >= 10: score -= 100
    """
    if tricks_taken < bid:
        return -(bid * 10)
    score = (bid * 10) + (tricks_taken - bid)
    if current_bags >= 10:
        score -= 100
    return score


def verify_hearts_score(tricks_taken_penalty_points: int) -> int:
    """PDF formula: Shoot the Moon when a player collects all 13 hearts
    + Q♠ worth penalty points (26 pts total) → return 0; else return the
    raw penalty count."""
    return 0 if tricks_taken_penalty_points == 26 else tricks_taken_penalty_points


# ── D. Hand-start broadcast payload (trump + rank mode) ─────────────────
def hand_broadcast_payload(
    trump_suit: Optional[str],
    bid_direction: str,
    is_no_trump: bool = False,
) -> Dict[str, Any]:
    """Build the canonical WS payload emitted at the top of each hand so
    no client suffers 'client-side blindness'."""
    return {
        "event": "hand_start",
        "trump_suit": None if is_no_trump else trump_suit,
        "rank_mode": "NO_TRUMP" if is_no_trump else (bid_direction or "uptown").upper(),
        "joker_power": {"big": BIG_JOKER_POWER, "little": LITTLE_JOKER_POWER},
        "turn_timer_ms": TURN_TIMER_MS,
    }


# ── E. Sovereign Tax pre-animation helper ────────────────────────────────
SOVEREIGN_TAX_RATE = 0.135


def apply_sovereign_tax(gross: int) -> Dict[str, int]:
    """Deduct the 13.5% Sovereign Tax from a gross payout BEFORE the
    win animation fires. Returns `{gross, tax, net}` — the caller must
    credit only `net` to the user and route `tax` to the Sovereign
    Treasury via `services.sovereign_engine.process_transaction`.
    """
    gross_i = max(0, int(gross))
    tax = int(round(gross_i * SOVEREIGN_TAX_RATE))
    return {"gross": gross_i, "tax": tax, "net": gross_i - tax}


__all__ = [
    "BIG_JOKER_POWER",
    "LITTLE_JOKER_POWER",
    "TURN_TIMER_MS",
    "SOVEREIGN_TAX_RATE",
    "is_joker",
    "get_power",
    "calculate_winner",
    "validate_turn_time",
    "verify_spades_score",
    "verify_hearts_score",
    "hand_broadcast_payload",
    "apply_sovereign_tax",
]
