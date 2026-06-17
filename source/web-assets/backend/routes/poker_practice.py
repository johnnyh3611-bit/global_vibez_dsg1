"""
Texas Hold'em Poker Practice - 1 user vs 3 AI bots.

Simplified NLHE with blinds 500/1000, starting stack ₵100,000.
Single-round variant: deal hole → flop → turn → river → showdown.
Actions per betting round: check/bet/call/raise/fold.

Endpoints:
    POST /api/poker-practice/start {num_bots}    # 1-5
    GET  /api/poker-practice/state/{game_id}
    POST /api/poker-practice/action {game_id, action, amount}
    POST /api/poker-practice/next-hand/{game_id}
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import uuid
import secrets

from utils.database import get_database, get_current_user
from utils.poker_evaluator import PokerHandEvaluator

router = APIRouter(prefix="/poker-practice", tags=["poker-practice"])

_rng = secrets.SystemRandom()

SUITS = ["S", "H", "D", "C"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]

STARTING_STACK = 100_000
SMALL_BLIND = 500
BIG_BLIND = 1000


# ==================== MODELS ====================

class StartRequest(BaseModel):
    num_bots: int = 3  # 1-5 bots


class ActionRequest(BaseModel):
    game_id: str
    action: str  # fold, check, call, bet, raise, allin
    amount: Optional[int] = 0


# ==================== HELPERS ====================

def _card_to_str(c: Dict[str, str]) -> str:
    return f"{c['rank']}{c['suit']}"


def _new_deck() -> List[Dict[str, str]]:
    deck = [{"rank": r, "suit": s} for s in SUITS for r in RANKS]
    _rng.shuffle(deck)
    return deck


def _to_evaluator_cards(hole: List[Dict[str, str]], board: List[Dict[str, str]]) -> List[str]:
    return [_card_to_str(c) for c in hole + board]


def _client_state(doc: Dict[str, Any]) -> Dict[str, Any]:
    player_seats = []
    for seat in doc["seats"]:
        revealed = seat["is_user"] or doc["phase"] == "showdown" or seat.get("mucked")
        player_seats.append({
            "seat_id": seat["seat_id"],
            "name": seat["name"],
            "is_user": seat["is_user"],
            "stack": seat["stack"],
            "bet": seat["bet"],
            "total_in_pot": seat.get("total_in_pot", 0),
            "status": seat["status"],  # active | folded | all-in | out
            "is_dealer": seat.get("is_dealer", False),
            "is_small_blind": seat.get("is_small_blind", False),
            "is_big_blind": seat.get("is_big_blind", False),
            "is_active_turn": seat["seat_id"] == doc["active_seat"],
            "hole_cards": seat["hole_cards"] if revealed else [{"rank": "?", "suit": "back"}] * len(seat["hole_cards"]),
            "hand_description": seat.get("hand_description") if doc["phase"] == "showdown" else None,
            "result": seat.get("result") if doc["phase"] == "showdown" else None,
            "payout": seat.get("payout", 0) if doc["phase"] == "showdown" else 0,
        })
    user_seat = next((s for s in doc["seats"] if s["is_user"]), None)
    valid = []
    if doc["phase"] in ("pre-flop", "flop", "turn", "river") and user_seat and user_seat["seat_id"] == doc["active_seat"]:
        to_call = doc["current_bet"] - user_seat["bet"]
        valid.append("fold")
        if to_call == 0:
            valid.append("check")
        else:
            valid.append("call")
        if user_seat["stack"] > to_call:
            valid.append("raise")
        valid.append("allin")
    return {
        "game_id": doc["game_id"],
        "phase": doc["phase"],
        "pot": doc["pot"],
        "current_bet": doc["current_bet"],
        "min_raise": doc.get("min_raise", BIG_BLIND),
        "board": doc["board"],
        "active_seat": doc["active_seat"],
        "seats": player_seats,
        "valid_actions": valid,
        "message": doc.get("message", ""),
        "winner_ids": doc.get("winner_ids", []),
    }


def _next_active(doc: Dict[str, Any], from_seat_id: str) -> Optional[str]:
    seats = doc["seats"]
    ids = [s["seat_id"] for s in seats]
    idx = ids.index(from_seat_id)
    for i in range(1, len(seats) + 1):
        nxt = seats[(idx + i) % len(seats)]
        if nxt["status"] == "active":
            return nxt["seat_id"]
    return None


def _active_seats(doc: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [s for s in doc["seats"] if s["status"] in ("active", "all-in")]


def _settle_round(doc: Dict[str, Any]) -> None:
    """Move bets into pot and reset current_bet."""
    for s in doc["seats"]:
        s["total_in_pot"] = s.get("total_in_pot", 0) + s["bet"]
        doc["pot"] += s["bet"]
        s["bet"] = 0
    doc["current_bet"] = 0
    doc["min_raise"] = BIG_BLIND


def _deal_street(doc: Dict[str, Any]) -> None:
    phase = doc["phase"]
    deck = doc["deck"]
    if phase == "pre-flop":
        # Burn, flop 3
        deck.pop()
        doc["board"].extend([deck.pop(), deck.pop(), deck.pop()])
        doc["phase"] = "flop"
    elif phase == "flop":
        deck.pop()
        doc["board"].append(deck.pop())
        doc["phase"] = "turn"
    elif phase == "turn":
        deck.pop()
        doc["board"].append(deck.pop())
        doc["phase"] = "river"
    elif phase == "river":
        doc["phase"] = "showdown"


def _bot_decision(doc: Dict[str, Any], seat: Dict[str, Any]) -> Dict[str, Any]:
    """Simple bot AI: evaluates hand strength and decides."""
    hole = seat["hole_cards"]
    board = doc["board"]
    to_call = doc["current_bet"] - seat["bet"]

    # Pre-flop: use premium-hand heuristic
    if len(board) == 0:
        ranks = sorted([PokerHandEvaluator.card_rank_value(c["rank"]) for c in hole], reverse=True)
        is_pair = hole[0]["rank"] == hole[1]["rank"]
        suited = hole[0]["suit"] == hole[1]["suit"]
        # Premium hands
        if is_pair and ranks[0] >= 10:  # TT+
            # Raise/bet
            if to_call > 0 and to_call < seat["stack"] * 0.2:
                return {"action": "raise", "amount": max(to_call + BIG_BLIND * 3, BIG_BLIND * 4)}
            if to_call == 0:
                return {"action": "raise", "amount": BIG_BLIND * 3}
            return {"action": "call"}
        if ranks[0] >= 13 and ranks[1] >= 10 and suited:  # AKs, AQs etc.
            if to_call == 0:
                return {"action": "raise", "amount": BIG_BLIND * 3}
            return {"action": "call"}
        if ranks[0] >= 12:  # A/K/Q high
            if to_call <= BIG_BLIND * 2:
                return {"action": "call"} if to_call > 0 else {"action": "check"}
            return {"action": "fold"}
        # Weak: fold unless cheap
        if to_call == 0:
            return {"action": "check"}
        if to_call <= SMALL_BLIND:
            return {"action": "call"}
        return {"action": "fold"}

    # Post-flop: evaluate hand
    eval_cards = _to_evaluator_cards(hole, board)
    hand_name, rank, _ = PokerHandEvaluator.evaluate_hand(eval_cards)
    if rank >= 4:  # 3-of-a-kind or better
        if to_call == 0:
            return {"action": "raise", "amount": min(doc["pot"], seat["stack"])}
        return {"action": "call"}
    if rank >= 2:  # pair+
        if to_call == 0:
            return {"action": "check"}
        if to_call <= doc["pot"] // 3:
            return {"action": "call"}
        return {"action": "fold"}
    # high card / weak
    if to_call == 0:
        return {"action": "check"}
    return {"action": "fold"}


def _advance_betting(doc: Dict[str, Any]) -> None:
    """Advance action clockwise. Auto-play bots. Move street when round closes."""
    safety = 0
    while safety < 200:
        safety += 1
        unfolded = [s for s in doc["seats"] if s["status"] == "active"]
        if len(unfolded) <= 1:
            # Everyone else folded
            doc["phase"] = "showdown"
            break

        # Round closes when all unfolded players have acted this round AND bets match
        acted = doc.get("acted_this_round", [])
        all_matched = all(s["bet"] == doc["current_bet"] or s["status"] != "active" for s in doc["seats"])
        all_acted = all(s["seat_id"] in acted for s in doc["seats"] if s["status"] == "active")
        if all_matched and all_acted:
            _settle_round(doc)
            if doc["phase"] == "river":
                doc["phase"] = "showdown"
                break
            _deal_street(doc)
            doc["acted_this_round"] = []
            # First-to-act post-flop = first active seat left of dealer
            dealer_seat = next(s for s in doc["seats"] if s["is_dealer"])
            nxt = _next_active(doc, dealer_seat["seat_id"])
            if nxt:
                doc["active_seat"] = nxt
            continue

        seat = next((s for s in doc["seats"] if s["seat_id"] == doc["active_seat"]), None)
        if not seat or seat["status"] != "active":
            nxt = _next_active(doc, doc["active_seat"]) if seat else None
            if nxt:
                doc["active_seat"] = nxt
            else:
                break
            continue
        if seat["is_user"]:
            return

        # Bot plays
        decision = _bot_decision(doc, seat)
        _apply_action(doc, seat, decision["action"], decision.get("amount", 0))


def _check_round_closed(doc: Dict[str, Any]) -> None:  # kept for compatibility, no-op
    pass


def _apply_action(doc: Dict[str, Any], seat: Dict[str, Any], action: str, amount: int = 0) -> None:
    to_call = doc["current_bet"] - seat["bet"]
    if "acted_this_round" not in doc:
        doc["acted_this_round"] = []

    if action == "fold":
        seat["status"] = "folded"
        if seat["seat_id"] not in doc["acted_this_round"]:
            doc["acted_this_round"].append(seat["seat_id"])
    elif action == "check":
        if to_call > 0:
            # Convert invalid check → call
            action = "call"
        else:
            if seat["seat_id"] not in doc["acted_this_round"]:
                doc["acted_this_round"].append(seat["seat_id"])
    if action == "call":
        pay = min(to_call, seat["stack"])
        seat["stack"] -= pay
        seat["bet"] += pay
        if seat["stack"] == 0:
            seat["status"] = "all-in"
        if seat["seat_id"] not in doc["acted_this_round"]:
            doc["acted_this_round"].append(seat["seat_id"])
    elif action == "raise" or action == "bet":
        target_bet = max(amount, doc["current_bet"] + doc["min_raise"]) if doc["current_bet"] > 0 else max(amount, BIG_BLIND)
        target_bet = min(target_bet, seat["stack"] + seat["bet"])
        raise_size = target_bet - doc["current_bet"]
        pay = target_bet - seat["bet"]
        seat["stack"] -= pay
        seat["bet"] = target_bet
        doc["current_bet"] = target_bet
        if raise_size > 0:
            doc["min_raise"] = max(raise_size, BIG_BLIND)
            # Re-open action: only this seat has "acted" in the new round
            doc["acted_this_round"] = [seat["seat_id"]]
        else:
            if seat["seat_id"] not in doc["acted_this_round"]:
                doc["acted_this_round"].append(seat["seat_id"])
        if seat["stack"] == 0:
            seat["status"] = "all-in"
    elif action == "allin":
        pay = seat["stack"]
        target_bet = seat["bet"] + pay
        seat["stack"] = 0
        seat["bet"] = target_bet
        raise_size = target_bet - doc["current_bet"]
        if target_bet > doc["current_bet"]:
            doc["current_bet"] = target_bet
            # Re-open action
            doc["acted_this_round"] = [seat["seat_id"]]
        else:
            if seat["seat_id"] not in doc["acted_this_round"]:
                doc["acted_this_round"].append(seat["seat_id"])
        seat["status"] = "all-in"

    # Advance turn
    nxt_id = _next_active(doc, seat["seat_id"])
    if nxt_id:
        doc["active_seat"] = nxt_id


def _do_showdown(doc: Dict[str, Any]) -> None:
    _settle_round(doc)
    contenders = [s for s in doc["seats"] if s["status"] in ("active", "all-in")]
    if len(contenders) == 1:
        w = contenders[0]
        w["payout"] = doc["pot"]
        w["stack"] += doc["pot"]
        w["result"] = "win"
        w["hand_description"] = "Last standing"
        doc["winner_ids"] = [w["seat_id"]]
        doc["pot"] = 0
        return
    # Evaluate everyone
    best_rank = 0
    best_kickers: List[int] = []
    winners: List[Dict[str, Any]] = []
    for s in contenders:
        eval_cards = _to_evaluator_cards(s["hole_cards"], doc["board"])
        hand_name, rank, kickers = PokerHandEvaluator.evaluate_hand(eval_cards)
        s["hand_description"] = hand_name
        s["_rank"] = rank
        s["_kickers"] = kickers
        if rank > best_rank or (rank == best_rank and kickers > best_kickers):
            best_rank = rank
            best_kickers = kickers
            winners = [s]
        elif rank == best_rank and kickers == best_kickers:
            winners.append(s)
    share = doc["pot"] // len(winners)
    for w in winners:
        w["payout"] = share
        w["stack"] += share
        w["result"] = "win"
    for s in contenders:
        if s not in winners:
            s["result"] = "loss"
    doc["winner_ids"] = [w["seat_id"] for w in winners]
    doc["pot"] = 0


def _deal_hand(doc: Dict[str, Any]) -> None:
    doc["deck"] = _new_deck()
    doc["board"] = []
    doc["pot"] = 0
    doc["current_bet"] = 0
    doc["min_raise"] = BIG_BLIND
    doc["phase"] = "pre-flop"
    doc["winner_ids"] = []
    doc["action_closed"] = False
    # Move dealer button
    seats = doc["seats"]
    for s in seats:
        s["hole_cards"] = []
        s["bet"] = 0
        s["total_in_pot"] = 0
        s["result"] = None
        s["payout"] = 0
        s["hand_description"] = None
        s["is_dealer"] = False
        s["is_small_blind"] = False
        s["is_big_blind"] = False
        if s["stack"] > 0:
            s["status"] = "active"
        else:
            s["status"] = "out"
    active = [i for i, s in enumerate(seats) if s["status"] == "active"]
    if len(active) < 2:
        doc["phase"] = "gameover"
        return
    # Rotate dealer
    prev_dealer = doc.get("dealer_index", -1)
    dealer_index = active[(active.index(prev_dealer) + 1) % len(active)] if prev_dealer in active else active[0]
    doc["dealer_index"] = dealer_index
    seats[dealer_index]["is_dealer"] = True
    # Blinds (heads-up: dealer = small blind; else dealer+1 = SB, dealer+2 = BB)
    if len(active) == 2:
        sb_idx = dealer_index
        bb_idx = active[(active.index(dealer_index) + 1) % 2]
    else:
        sb_idx = active[(active.index(dealer_index) + 1) % len(active)]
        bb_idx = active[(active.index(dealer_index) + 2) % len(active)]
    seats[sb_idx]["is_small_blind"] = True
    seats[bb_idx]["is_big_blind"] = True
    # Post blinds
    sb = seats[sb_idx]
    bb = seats[bb_idx]
    sb_pay = min(SMALL_BLIND, sb["stack"])
    sb["stack"] -= sb_pay
    sb["bet"] = sb_pay
    bb_pay = min(BIG_BLIND, bb["stack"])
    bb["stack"] -= bb_pay
    bb["bet"] = bb_pay
    doc["current_bet"] = BIG_BLIND
    doc["last_aggressor"] = bb["seat_id"]
    # First to act pre-flop = seat after BB (UTG)
    first_idx = active[(active.index(bb_idx) + 1) % len(active)] if len(active) > 2 else sb_idx
    doc["active_seat"] = seats[first_idx]["seat_id"]
    doc["round_first_to_act"] = seats[first_idx]["seat_id"]
    doc["last_aggressor_after"] = seats[first_idx]["seat_id"]
    # Deal 2 hole cards each
    for _ in range(2):
        for i in active:
            seats[i]["hole_cards"].append(doc["deck"].pop())


# ==================== ENDPOINTS ====================

@router.post("/start")
async def start(req: StartRequest, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    num_bots = max(1, min(5, req.num_bots))
    seats: List[Dict[str, Any]] = [{
        "seat_id": "seat_0",
        "name": "You",
        "is_user": True,
        "stack": STARTING_STACK,
        "bet": 0,
        "total_in_pot": 0,
        "hole_cards": [],
        "status": "active",
    }]
    bot_names = ["Bot Ace", "Bot Vera", "Bot Nova", "Bot Kai", "Bot Zen"]
    for i in range(num_bots):
        seats.append({
            "seat_id": f"seat_{i+1}",
            "name": bot_names[i],
            "is_user": False,
            "stack": STARTING_STACK,
            "bet": 0,
            "total_in_pot": 0,
            "hole_cards": [],
            "status": "active",
        })
    game_id = f"poker_practice_{uuid.uuid4().hex[:12]}"
    doc: Dict[str, Any] = {
        "game_id": game_id,
        "user_id": current_user.user_id,
        "seats": seats,
        "dealer_index": -1,
        "deck": [],
        "board": [],
        "pot": 0,
        "current_bet": 0,
        "phase": "pre-flop",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _deal_hand(doc)
    doc["acted_this_round"] = []
    # Auto-play bots until user's turn
    _advance_betting(doc)

    db = get_database()
    await db.poker_practice.insert_one(doc)
    return _client_state(doc)


@router.get("/state/{game_id}")
async def state(game_id: str, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    doc = await db.poker_practice.find_one(
        {"game_id": game_id, "user_id": current_user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")
    return _client_state(doc)


@router.post("/action")
async def action(data: ActionRequest, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    doc = await db.poker_practice.find_one(
        {"game_id": data.game_id, "user_id": current_user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")
    if doc["phase"] not in ("pre-flop", "flop", "turn", "river"):
        raise HTTPException(status_code=400, detail="Not in betting phase")
    seat = next((s for s in doc["seats"] if s["seat_id"] == doc["active_seat"]), None)
    if not seat or not seat["is_user"]:
        raise HTTPException(status_code=400, detail="Not your turn")

    act = data.action
    if act not in ("fold", "check", "call", "bet", "raise", "allin"):
        raise HTTPException(status_code=400, detail="Invalid action")

    _apply_action(doc, seat, act, data.amount or 0)
    _check_round_closed(doc)
    _advance_betting(doc)

    if doc["phase"] == "showdown":
        _do_showdown(doc)

    await db.poker_practice.update_one({"game_id": data.game_id}, {"$set": doc})
    return _client_state(doc)


@router.post("/next-hand/{game_id}")
async def next_hand(game_id: str, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    db = get_database()
    doc = await db.poker_practice.find_one(
        {"game_id": game_id, "user_id": current_user.user_id}, {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")
    _deal_hand(doc)
    doc["acted_this_round"] = []
    _advance_betting(doc)
    await db.poker_practice.update_one({"game_id": game_id}, {"$set": doc})
    return _client_state(doc)
