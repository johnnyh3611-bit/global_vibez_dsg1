"""
Blackjack Universal - Multi-seat Blackjack (1-7 seats) vs shared dealer NOVA.

User occupies one seat; up to 2 bots play at other seats using Basic Strategy.
Dealer hits soft 17. 6-deck shoe. Blackjack pays 3:2.

Endpoints:
    POST /api/blackjack-universal/start {num_bots}
    GET  /api/blackjack-universal/state/{game_id}
    POST /api/blackjack-universal/bet   {game_id, bet}
    POST /api/blackjack-universal/action {game_id, action} (hit/stand/double)
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime, timezone
import uuid
import secrets

from utils.database import get_database, get_current_user

router = APIRouter(prefix="/blackjack-universal", tags=["blackjack-universal"])

_rng = secrets.SystemRandom()

SUITS = ["spades", "hearts", "diamonds", "clubs"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]


# ==================== MODELS ====================

class StartRequest(BaseModel):
    num_bots: int = 2  # 0-2 bots


class BetRequest(BaseModel):
    game_id: str
    bet: int = 1000


class ActionRequest(BaseModel):
    game_id: str
    action: str  # hit, stand, double


# ==================== HELPERS ====================

def _new_shoe() -> List[Dict[str, str]]:
    shoe: List[Dict[str, str]] = []
    for _ in range(6):
        for s in SUITS:
            for r in RANKS:
                shoe.append({"suit": s, "rank": r})
    _rng.shuffle(shoe)
    return shoe


def _card_value(rank: str) -> int:
    if rank in ("J", "Q", "K"):
        return 10
    if rank == "A":
        return 11
    return int(rank)


def _hand_value(cards: List[Dict[str, str]]) -> int:
    total = sum(_card_value(c["rank"]) for c in cards)
    aces = sum(1 for c in cards if c["rank"] == "A")
    while total > 21 and aces:
        total -= 10
        aces -= 1
    return total


def _is_blackjack(cards: List[Dict[str, str]]) -> bool:
    return len(cards) == 2 and _hand_value(cards) == 21


def _basic_strategy(hand: List[Dict[str, str]], dealer_up: Dict[str, str]) -> str:
    """Simplified basic strategy for bots."""
    total = _hand_value(hand)
    dealer_val = _card_value(dealer_up["rank"])
    has_ace = any(c["rank"] == "A" for c in hand)
    # Soft hand
    is_soft = has_ace and _hand_value(hand) != sum(_card_value(c["rank"]) for c in hand)

    if total >= 17:
        return "stand"
    if total <= 11:
        return "hit"
    if is_soft:
        if total <= 17:
            return "hit"
        return "stand"
    # Hard 12-16
    if 4 <= dealer_val <= 6:
        return "stand"
    return "hit"


def _seat_state(seat: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "seat_id": seat["seat_id"],
        "player_type": seat["player_type"],  # user | bot
        "name": seat["name"],
        "hand": seat["hand"],
        "bet": seat["bet"],
        "value": _hand_value(seat["hand"]) if seat["hand"] else 0,
        "status": seat["status"],  # waiting | playing | stand | bust | blackjack | done
        "result": seat.get("result"),
        "payout": seat.get("payout", 0),
    }


def _client_state(doc: Dict[str, Any]) -> Dict[str, Any]:
    dealer = doc["dealer"]
    dealer_visible = dealer["hand"] if doc["phase"] in ("dealer", "settled") else (
        [dealer["hand"][0], {"suit": "back", "rank": "?"}] if len(dealer["hand"]) >= 2 else dealer["hand"]
    )
    return {
        "game_id": doc["game_id"],
        "phase": doc["phase"],
        "active_seat": doc["active_seat"],
        "dealer": {
            "hand": dealer_visible,
            "value": _hand_value(dealer["hand"]) if doc["phase"] in ("dealer", "settled") else _hand_value([dealer["hand"][0]]) if dealer["hand"] else 0,
            "is_blackjack": doc["phase"] == "settled" and _is_blackjack(dealer["hand"]),
        },
        "seats": [_seat_state(s) for s in doc["seats"]],
        "user_seat_id": doc["user_seat_id"],
        "shoe_remaining": len(doc["shoe"]),
        "message": doc.get("message", ""),
    }


def _settle(doc: Dict[str, Any]) -> None:
    dealer_val = _hand_value(doc["dealer"]["hand"])
    dealer_bj = _is_blackjack(doc["dealer"]["hand"])
    dealer_bust = dealer_val > 21
    for seat in doc["seats"]:
        if not seat["hand"]:
            continue
        val = _hand_value(seat["hand"])
        bet = seat["bet"]
        if seat["status"] == "bust":
            seat["result"] = "loss"
            seat["payout"] = 0
        elif _is_blackjack(seat["hand"]) and not dealer_bj:
            seat["result"] = "blackjack"
            seat["payout"] = int(bet * 2.5)  # 3:2 includes original
        elif dealer_bj and not _is_blackjack(seat["hand"]):
            seat["result"] = "loss"
            seat["payout"] = 0
        elif dealer_bj and _is_blackjack(seat["hand"]):
            seat["result"] = "push"
            seat["payout"] = bet
        elif dealer_bust:
            seat["result"] = "win"
            seat["payout"] = bet * 2
        elif val > dealer_val:
            seat["result"] = "win"
            seat["payout"] = bet * 2
        elif val < dealer_val:
            seat["result"] = "loss"
            seat["payout"] = 0
        else:
            seat["result"] = "push"
            seat["payout"] = bet
        seat["status"] = "done"


async def _auto_play_bots(doc: Dict[str, Any]) -> None:
    """Advance active seat; auto-play bots until user or dealer."""
    dealer_up = doc["dealer"]["hand"][0] if doc["dealer"]["hand"] else {"rank": "10", "suit": "spades"}

    while doc["active_seat"] < len(doc["seats"]):
        seat = doc["seats"][doc["active_seat"]]
        if seat["status"] == "done" or seat["status"] == "bust" or seat["status"] == "stand":
            doc["active_seat"] += 1
            continue
        if seat["player_type"] == "user":
            # Stop for user input
            seat["status"] = "playing"
            return
        # Bot: apply basic strategy until stand/bust
        safety = 0
        while seat["status"] == "playing" or seat["status"] == "waiting":
            safety += 1
            if safety > 10:
                seat["status"] = "stand"
                break
            seat["status"] = "playing"
            move = _basic_strategy(seat["hand"], dealer_up)
            if move == "stand":
                seat["status"] = "stand"
                break
            # hit
            seat["hand"].append(doc["shoe"].pop())
            if _hand_value(seat["hand"]) > 21:
                seat["status"] = "bust"
                break
            if _hand_value(seat["hand"]) == 21:
                seat["status"] = "stand"
                break
        doc["active_seat"] += 1

    # All seats done → dealer plays
    doc["phase"] = "dealer"
    while _hand_value(doc["dealer"]["hand"]) < 17:
        doc["dealer"]["hand"].append(doc["shoe"].pop())
    # Soft 17 — dealer stands on all 17 (S17). To match most casinos.
    doc["phase"] = "settled"
    _settle(doc)


# ==================== ENDPOINTS ====================

@router.post("/start")
async def start(req: StartRequest, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    num_bots = max(0, min(2, req.num_bots))
    seats: List[Dict[str, Any]] = []
    user_seat_id = "seat_0"
    seats.append({
        "seat_id": user_seat_id,
        "player_type": "user",
        "name": "You",
        "hand": [],
        "bet": 0,
        "status": "waiting",
    })
    for i in range(num_bots):
        seats.append({
            "seat_id": f"seat_{i + 1}",
            "player_type": "bot",
            "name": f"Bot {['Ace', 'Vera', 'Nova'][i]}",
            "hand": [],
            "bet": 0,
            "status": "waiting",
        })

    game_id = f"bj_univ_{uuid.uuid4().hex[:12]}"
    doc = {
        "game_id": game_id,
        "user_id": current_user.user_id,
        "phase": "betting",
        "active_seat": 0,
        "seats": seats,
        "dealer": {"hand": []},
        "shoe": _new_shoe(),
        "user_seat_id": user_seat_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
        "message": f"Place your bet. {num_bots} bot(s) joined.",
    }

    db = get_database()
    await db.blackjack_universal.insert_one(doc)
    return _client_state(doc)


@router.get("/state/{game_id}")
async def state(game_id: str, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    doc = await db.blackjack_universal.find_one(
        {"game_id": game_id, "user_id": current_user.user_id},
        {"_id": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")
    return _client_state(doc)


@router.post("/bet")
async def bet(data: BetRequest, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if data.bet < 100 or data.bet > 1_000_000:
        raise HTTPException(status_code=400, detail="Bet must be 100-1,000,000")

    db = get_database()
    doc = await db.blackjack_universal.find_one(
        {"game_id": data.game_id, "user_id": current_user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")
    if doc["phase"] != "betting":
        raise HTTPException(status_code=400, detail="Betting closed")

    # Set bets: user's bet from input; bots mirror user
    for seat in doc["seats"]:
        seat["bet"] = data.bet
        seat["status"] = "waiting"
        seat["hand"] = []

    # Deal 2 cards each, then dealer
    doc["dealer"]["hand"] = []
    for _ in range(2):
        for seat in doc["seats"]:
            seat["hand"].append(doc["shoe"].pop())
        doc["dealer"]["hand"].append(doc["shoe"].pop())

    doc["phase"] = "playing"
    doc["active_seat"] = 0
    doc["message"] = "Cards dealt."

    # Check for dealer blackjack peek
    if _is_blackjack(doc["dealer"]["hand"]):
        doc["phase"] = "settled"
        for seat in doc["seats"]:
            if _is_blackjack(seat["hand"]):
                seat["status"] = "blackjack"
            else:
                seat["status"] = "done"
        _settle(doc)
    else:
        # Mark blackjack players as done
        for seat in doc["seats"]:
            if _is_blackjack(seat["hand"]):
                seat["status"] = "blackjack"
        # Advance to first non-BJ seat
        await _auto_play_bots(doc)

    await db.blackjack_universal.update_one({"game_id": data.game_id}, {"$set": doc})
    return _client_state(doc)


@router.post("/action")
async def action(data: ActionRequest, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if data.action not in ("hit", "stand", "double"):
        raise HTTPException(status_code=400, detail="Invalid action")
    db = get_database()
    doc = await db.blackjack_universal.find_one(
        {"game_id": data.game_id, "user_id": current_user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")
    if doc["phase"] != "playing":
        raise HTTPException(status_code=400, detail="Not in playing phase")

    seat = doc["seats"][doc["active_seat"]]
    if seat["player_type"] != "user":
        raise HTTPException(status_code=400, detail="Not your turn")

    if data.action == "hit":
        seat["hand"].append(doc["shoe"].pop())
        if _hand_value(seat["hand"]) > 21:
            seat["status"] = "bust"
            doc["active_seat"] += 1
        elif _hand_value(seat["hand"]) == 21:
            seat["status"] = "stand"
            doc["active_seat"] += 1
    elif data.action == "stand":
        seat["status"] = "stand"
        doc["active_seat"] += 1
    elif data.action == "double":
        if len(seat["hand"]) != 2:
            raise HTTPException(status_code=400, detail="Can only double on first 2 cards")
        seat["bet"] *= 2
        seat["hand"].append(doc["shoe"].pop())
        seat["status"] = "bust" if _hand_value(seat["hand"]) > 21 else "stand"
        doc["active_seat"] += 1

    # Advance bots/dealer if needed
    if doc["active_seat"] < len(doc["seats"]):
        await _auto_play_bots(doc)
    else:
        # Dealer plays
        doc["phase"] = "dealer"
        while _hand_value(doc["dealer"]["hand"]) < 17:
            doc["dealer"]["hand"].append(doc["shoe"].pop())
        doc["phase"] = "settled"
        _settle(doc)

    await db.blackjack_universal.update_one({"game_id": data.game_id}, {"$set": doc})
    return _client_state(doc)


@router.post("/next-round/{game_id}")
async def next_round(game_id: str, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    doc = await db.blackjack_universal.find_one(
        {"game_id": game_id, "user_id": current_user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")
    # Reset hands and bets, keep shoe
    for seat in doc["seats"]:
        seat["hand"] = []
        seat["bet"] = 0
        seat["status"] = "waiting"
        seat["result"] = None
        seat["payout"] = 0
    doc["dealer"]["hand"] = []
    doc["phase"] = "betting"
    doc["active_seat"] = 0
    doc["message"] = "Place your bet."
    if len(doc["shoe"]) < 52:
        doc["shoe"] = _new_shoe()
    await db.blackjack_universal.update_one({"game_id": game_id}, {"$set": doc})
    return _client_state(doc)
