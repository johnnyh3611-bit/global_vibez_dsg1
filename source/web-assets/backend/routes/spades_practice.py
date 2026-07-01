"""
Spades Practice Mode - Bot auto-play for single-player vs 3 AI opponents.

Layout:
    - User sits at SOUTH (team1)
    - AI_NORTH (team1, partner), AI_EAST (team2), AI_WEST (team2)
    - 13 tricks per hand, first team to 200 points wins.

Endpoints:
    POST /api/spades-practice/start   → create room, deal cards
    GET  /api/spades-practice/state/{game_id}
    POST /api/spades-practice/bid      {game_id, bid}   (0-13)
    POST /api/spades-practice/play     {game_id, card}  ({suit,rank,value})
    POST /api/spades-practice/new-hand/{game_id}
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime, timezone
import uuid

from utils.database import get_database, get_current_user
from utils.spades_game import SpadesGame, get_spades_ai_bid, get_spades_ai_play

router = APIRouter(prefix="/spades-practice", tags=["spades-practice"])

POSITIONS = ["south", "west", "north", "east"]  # Play order after dealer
USER_POS = "south"
BOT_POS = {"north": "AI_NORTH", "east": "AI_EAST", "west": "AI_WEST"}


# ==================== MODELS ====================

class StartRequest(BaseModel):
    ruleset: str = "CLASSIC"  # "CLASSIC" or "BIG_WHEEL"


class BidRequest(BaseModel):
    game_id: str
    bid: int


class PlayRequest(BaseModel):
    game_id: str
    card: Dict[str, Any]


# ==================== HELPERS ====================

def _game_to_doc(game: SpadesGame, game_id: str, user_id: str) -> Dict[str, Any]:
    return {
        "game_id": game_id,
        "mode": "practice",
        "ruleset": game.ruleset_name,
        "user_id": user_id,
        "players_data": {
            pos: {
                "hand": p["hand"],
                "bid": p["bid"],
                "tricks": p["tricks"],
                "team": p["team"],
            }
            for pos, p in game.players.items()
        },
        "scores": game.scores,
        "current_trick": game.current_trick,
        "tricks_played": game.tricks_played,
        "spades_broken": game.spades_broken,
        "phase": game.game_phase,
        "turn_position": getattr(game, "turn_position", USER_POS),
        "led_suit": getattr(game, "led_suit", None),
        "winner": getattr(game, "winner", None),
        "hand_history": getattr(game, "hand_history", []),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def _doc_to_game(doc: Dict[str, Any]) -> SpadesGame:
    # Reconstruct with the persisted ruleset so promoted-trump scoring &
    # Big-Wheel deck shape survive across requests. Fallback to CLASSIC
    # for legacy practice rows that pre-date the ruleset column.
    game = SpadesGame(ruleset=doc.get("ruleset", "CLASSIC"))
    game.players = doc["players_data"]
    game.scores = doc["scores"]
    game.current_trick = doc.get("current_trick", [])
    game.tricks_played = doc.get("tricks_played", 0)
    game.spades_broken = doc.get("spades_broken", False)
    game.game_phase = doc.get("phase", "bidding")
    game.led_suit = doc.get("led_suit")
    game.turn_position = doc.get("turn_position", USER_POS)
    if doc.get("winner"):
        game.winner = doc["winner"]
    return game


def _client_state(game: SpadesGame, game_id: str) -> Dict[str, Any]:
    user = game.players[USER_POS]
    return {
        "game_id": game_id,
        "mode": "practice",
        "ruleset": game.ruleset_name,
        "ruleset_label": game.ruleset["label"],
        "your_position": USER_POS,
        "your_team": user["team"],
        "your_hand": user["hand"],
        "your_bid": user["bid"],
        "your_tricks": user["tricks"],
        "phase": game.game_phase,
        "turn_position": getattr(game, "turn_position", USER_POS),
        "current_trick": game.current_trick,
        "led_suit": getattr(game, "led_suit", None),
        "tricks_played": game.tricks_played,
        "spades_broken": game.spades_broken,
        "players": {
            pos: {
                "hand_count": len(p["hand"]),
                "bid": p["bid"],
                "tricks": p["tricks"],
                "team": p["team"],
                "is_bot": pos != USER_POS,
                "name": "You" if pos == USER_POS else BOT_POS.get(pos, pos).replace("AI_", ""),
            }
            for pos, p in game.players.items()
        },
        "scores": game.scores,
        "valid_plays": game.get_valid_plays(USER_POS) if game.game_phase == "playing" else [],
        "winner": getattr(game, "winner", None),
        "hand_history": getattr(game, "hand_history", [])[-1:],
    }


def _next_position(pos: str) -> str:
    # Clockwise: south → west → north → east → south
    order = ["south", "west", "north", "east"]
    return order[(order.index(pos) + 1) % 4]


def _advance_bot_bids(game: SpadesGame) -> None:
    """Auto-bid for bots when it's their turn in bidding order."""
    if game.game_phase != "bidding":
        return
    bid_order = ["south", "west", "north", "east"]
    for pos in bid_order:
        if game.players[pos]["bid"] == 0 and pos != USER_POS:
            # Still 0 means "not yet bid" unless user bid 0 exactly
            # Track bids_placed separately via a list
            pass
    # Track bids via 'bids_placed' attr
    if not hasattr(game, "bids_placed"):
        game.bids_placed = []
    # Auto-bid for bots in order until human's turn
    while len(game.bids_placed) < 4:
        pos = bid_order[len(game.bids_placed)]
        if pos == USER_POS:
            break
        bid = get_spades_ai_bid(game.players[pos]["hand"])
        game.players[pos]["bid"] = bid
        game.bids_placed.append(pos)

    # If all 4 bids placed, enter playing phase
    if len(game.bids_placed) == 4:
        game.game_phase = "playing"
        game.turn_position = "south"  # user leads first trick


def _advance_bot_plays(game: SpadesGame) -> Dict[str, Any]:
    """Auto-play bot cards until it's user's turn or trick is complete."""
    events: List[Dict[str, Any]] = []
    safety = 0
    while game.game_phase == "playing" and game.turn_position != USER_POS and safety < 20:
        safety += 1
        pos = game.turn_position
        hand = game.players[pos]["hand"]
        valid = game.get_valid_plays(pos)
        led_suit = game.current_trick[0]["card"]["suit"] if game.current_trick else None
        card = get_spades_ai_play(
            valid if valid else hand,
            game.current_trick,
            led_suit,
            game.spades_broken,
        )
        res = game.play_card(pos, card)
        events.append({"player": pos, "card": card, "trick_winner": res.get("trick_winner")})
        if res.get("trick_winner"):
            game.turn_position = res["trick_winner"]
            # Record trick in history
            if not hasattr(game, "hand_history"):
                game.hand_history = []
            game.hand_history.append({"winner": res["trick_winner"]})
            if game.tricks_played == 13:
                # score_hand already called inside play_card → resets hand → phase = 'bidding' or 'finished'
                break
        else:
            game.turn_position = _next_position(pos)
    return {"events": events}


# ==================== ENDPOINTS ====================

@router.post("/start")
async def start_practice(request: Request, data: StartRequest = StartRequest()) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()

    # Validate ruleset before construction so we surface a clean 400.
    from utils.spades_game import RULESETS
    ruleset = (data.ruleset or "CLASSIC").upper()
    if ruleset not in RULESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown ruleset '{ruleset}'. Choose: {', '.join(RULESETS)}",
        )

    game = SpadesGame(ruleset=ruleset)
    game.deal_cards()
    game.game_phase = "bidding"
    game.turn_position = USER_POS
    game.hand_history = []
    game.bids_placed = []

    game_id = f"spades_practice_{uuid.uuid4().hex[:12]}"
    doc = _game_to_doc(game, game_id, current_user.user_id)
    doc["bids_placed"] = []
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["status"] = "active"
    await db.spades_practice.insert_one(doc)

    return {"success": True, "game": _client_state(game, game_id)}


@router.get("/state/{game_id}")
async def get_state(game_id: str, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    doc = await db.spades_practice.find_one({"game_id": game_id, "user_id": current_user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")

    game = _doc_to_game(doc)
    game.bids_placed = doc.get("bids_placed", [])
    game.hand_history = doc.get("hand_history", [])
    return _client_state(game, game_id)


@router.post("/bid")
async def place_bid(data: BidRequest, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    if data.bid < 0 or data.bid > 13:
        raise HTTPException(status_code=400, detail="Bid must be 0-13")

    db = get_database()
    doc = await db.spades_practice.find_one({"game_id": data.game_id, "user_id": current_user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")

    if doc["phase"] != "bidding":
        raise HTTPException(status_code=400, detail="Not in bidding phase")

    game = _doc_to_game(doc)
    game.bids_placed = doc.get("bids_placed", [])
    game.hand_history = doc.get("hand_history", [])

    # First let bots bid in order before user if any
    _advance_bot_bids(game)

    # Now user bids (it must be user's turn since _advance stops at user)
    if USER_POS in game.bids_placed:
        raise HTTPException(status_code=400, detail="You already bid")
    game.players[USER_POS]["bid"] = data.bid
    game.bids_placed.append(USER_POS)

    # Remaining bots bid
    _advance_bot_bids(game)

    new_doc = _game_to_doc(game, data.game_id, current_user.user_id)
    new_doc["bids_placed"] = game.bids_placed
    await db.spades_practice.update_one({"game_id": data.game_id}, {"$set": new_doc})

    return _client_state(game, data.game_id)


@router.post("/play")
async def play_card(data: PlayRequest, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    doc = await db.spades_practice.find_one({"game_id": data.game_id, "user_id": current_user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")

    if doc["phase"] != "playing":
        raise HTTPException(status_code=400, detail="Not in playing phase")

    game = _doc_to_game(doc)
    game.bids_placed = doc.get("bids_placed", [])
    game.hand_history = doc.get("hand_history", [])

    if game.turn_position != USER_POS:
        # Bots should catch up first
        _advance_bot_plays(game)
        if game.turn_position != USER_POS:
            # Hand ended; skip play
            new_doc = _game_to_doc(game, data.game_id, current_user.user_id)
            new_doc["bids_placed"] = game.bids_placed
            await db.spades_practice.update_one({"game_id": data.game_id}, {"$set": new_doc})
            return _client_state(game, data.game_id)

    # Validate user card is in hand and in valid plays
    valid = game.get_valid_plays(USER_POS)
    card_match = next(
        (c for c in valid if c["suit"] == data.card.get("suit") and c["rank"] == data.card.get("rank")),
        None,
    )
    if not card_match:
        raise HTTPException(status_code=400, detail="Invalid card for current trick")

    # Play user's card
    res = game.play_card(USER_POS, card_match)
    # Track the ordered play sequence (user + bots) so the frontend
    # can stage the card reveals one-by-one with visible pauses.
    # Each entry: {player, card, trick_winner|null, trick_complete:bool}
    play_sequence: list = [{
        "player": USER_POS,
        "card": card_match,
        "trick_winner": res.get("trick_winner"),
        "trick_complete": bool(res.get("trick_winner")),
    }]
    if res.get("trick_winner"):
        game.turn_position = res["trick_winner"]
        if not hasattr(game, "hand_history"):
            game.hand_history = []
        game.hand_history.append({"winner": res["trick_winner"]})
    else:
        game.turn_position = _next_position(USER_POS)

    # Bots play until user or hand/game ends. Bot moves are appended to
    # play_sequence so the frontend has the full ordered timeline.
    bot_result = _advance_bot_plays(game)
    for ev in bot_result.get("events", []):
        play_sequence.append({
            "player": ev["player"],
            "card": ev["card"],
            "trick_winner": ev.get("trick_winner"),
            "trick_complete": bool(ev.get("trick_winner")),
        })

    # If score_hand rotated to new hand (game.game_phase == 'bidding'), re-run bot bids
    if game.game_phase == "bidding":
        game.bids_placed = []
        game.turn_position = USER_POS
        _advance_bot_bids(game)

    new_doc = _game_to_doc(game, data.game_id, current_user.user_id)
    new_doc["bids_placed"] = game.bids_placed
    if game.game_phase == "finished":
        new_doc["status"] = "completed"
    await db.spades_practice.update_one({"game_id": data.game_id}, {"$set": new_doc})

    response = _client_state(game, data.game_id)
    response["play_sequence"] = play_sequence
    return response


@router.post("/new-hand/{game_id}")
async def new_hand(game_id: str, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = get_database()
    doc = await db.spades_practice.find_one({"game_id": game_id, "user_id": current_user.user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Game not found")

    game = _doc_to_game(doc)
    game.bids_placed = []
    game.hand_history = []
    game.reset_hand()
    game.turn_position = USER_POS
    _advance_bot_bids(game)

    new_doc = _game_to_doc(game, game_id, current_user.user_id)
    new_doc["bids_placed"] = game.bids_placed
    await db.spades_practice.update_one({"game_id": game_id}, {"$set": new_doc})

    return _client_state(game, game_id)
