"""
Bid Whist Practice Mode - vs AI
Single player practice with 3 AI opponents
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from utils.database import get_database, get_current_user
from utils.bid_whist_game import BidWhistGame
from utils.bid_whist_ai import BidWhistAI
from datetime import datetime, timezone

router = APIRouter(prefix="/bid-whist-practice", tags=["bid-whist-practice"])

# AI instance
ai = BidWhistAI(difficulty="moderate")


class StartPracticeRequest(BaseModel):
    bet_amount: int = 0  # For consistency, practice mode is free


class BidRequest(BaseModel):
    amount: Optional[int] = None
    bid_type: Optional[str] = None
    trump_suit: Optional[str] = None


class PlayCardRequest(BaseModel):
    card: Dict


class KittyExchangeRequest(BaseModel):
    discarded_cards: List[Dict]
    trump_suit: str


@router.post("/start")
async def start_practice_game(request: Request, data: StartPracticeRequest) -> Dict[str, Any]:
    """Start a practice game vs AI"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Create new practice game
    game = BidWhistGame()
    
    # Set up players - User is South, AIs are North, East, West
    # NOTE: BidWhistGame stores player IDs in `self.player_mapping[position]`
    # — there is no add_player() method. Direct assignment is the API.
    game.player_mapping["south"] = current_user.user_id  # User (Team 2)
    game.player_mapping["north"] = "AI_NORTH"  # User's partner (Team 2)
    game.player_mapping["east"] = "AI_EAST"   # Opponent (Team 1)
    game.player_mapping["west"] = "AI_WEST"   # Opponent (Team 1)
    
    # Deal cards
    game.deal_cards()
    
    # Save game to database
    game_data = game.save_state()
    game_data.update({
        "game_id": f"practice_{current_user.user_id}_{datetime.now(timezone.utc).timestamp()}",
        "mode": "practice",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user.user_id
    })
    
    await db.bid_whist_practice.insert_one(game_data)
    
    # Let any AIs that come before the human (south) in bid order go first so
    # the user lands on a board that's actually waiting for THEIR bid.
    await process_ai_turns(game, db, game_data["game_id"])
    # Reload the freshest state from the post-AI save
    refreshed = await db.bid_whist_practice.find_one(
        {"game_id": game_data["game_id"]},
        {"_id": 0}
    )
    if refreshed:
        game.load_state(refreshed)
    
    # Get client state for user (viewer_id is the actual user_id; the helper
    # resolves it back to "south" via self.player_mapping).
    client_state = game.get_client_state(current_user.user_id)
    client_state["game_id"] = game_data["game_id"]
    client_state["mode"] = "practice"
    
    return {
        "success": True,
        "game": client_state
    }


@router.get("/state")
async def get_practice_state(request: Request) -> Dict[str, Any]:
    """Get current practice game state"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Find user's active practice game
    game_doc = await db.bid_whist_practice.find_one(
        {"user_id": current_user.user_id, "status": {"$ne": "completed"}},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not game_doc:
        raise HTTPException(status_code=404, detail="No active practice game")
    
    # Load game state
    game = BidWhistGame()
    game.load_state(game_doc)
    
    # Get client state
    client_state = game.get_client_state(current_user.user_id)
    client_state["game_id"] = game_doc["game_id"]
    client_state["mode"] = "practice"
    
    return {
        "success": True,
        "game": client_state
    }


@router.post("/bid")
async def place_bid(request: Request, data: BidRequest) -> Dict[str, Any]:
    """Place a bid (user's turn)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Load game
    game_doc = await db.bid_whist_practice.find_one(
        {"user_id": current_user.user_id, "status": {"$ne": "completed"}},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not game_doc:
        raise HTTPException(status_code=404, detail="No active practice game")
    
    game = BidWhistGame()
    game.load_state(game_doc)
    
    # Place user's bid. The underlying BidWhistGame.place_bid signature is
    # (position, amount, bid_type) — no pass_bid kwarg, no trump_suit (trump
    # is declared later in kitty_exchange phase). For "pass", return early.
    if data.amount is None:
        # Pass — record a non-winning bid so bidding can complete (max picks
        # the highest value; passes use value=-1 so a real bid always wins).
        game.bids.append({'player': 'south', 'amount': 0, 'type': 'pass', 'value': -1})
        if len(game.bids) >= 4:
            real_bids = [b for b in game.bids if b['type'] != 'pass']
            if real_bids:
                winning = max(real_bids, key=lambda b: b['value'])
                game.winning_bid = winning
                game.bid_winner = winning['player']
                game.bid_type = winning['type']
                game.game_phase = 'kitty_exchange'
    else:
        game.place_bid("south", data.amount, data.bid_type)
    
    # Process AI bids automatically
    await process_ai_turns(game, db, game_doc["game_id"])
    
    # Save updated game
    updated_data = game.save_state()
    updated_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.bid_whist_practice.update_one(
        {"game_id": game_doc["game_id"]},
        {"$set": updated_data}
    )
    
    client_state = game.get_client_state(current_user.user_id)
    client_state["game_id"] = game_doc["game_id"]
    
    return {
        "success": True,
        "game": client_state
    }


@router.post("/kitty-exchange")
async def exchange_kitty(request: Request, data: KittyExchangeRequest) -> Dict[str, Any]:
    """Exchange kitty cards"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game_doc = await db.bid_whist_practice.find_one(
        {"user_id": current_user.user_id, "status": {"$ne": "completed"}},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not game_doc:
        raise HTTPException(status_code=404, detail="No active practice game")
    
    game = BidWhistGame()
    game.load_state(game_doc)
    
    # Exchange kitty. Underlying signature: (position, trump_suit, discards).
    game.exchange_kitty("south", data.trump_suit, data.discarded_cards)
    
    # Save
    updated_data = game.save_state()
    await db.bid_whist_practice.update_one(
        {"game_id": game_doc["game_id"]},
        {"$set": updated_data}
    )
    
    client_state = game.get_client_state(current_user.user_id)
    client_state["game_id"] = game_doc["game_id"]
    
    return {
        "success": True,
        "game": client_state
    }


@router.post("/play")
async def play_card(request: Request, data: PlayCardRequest) -> Dict[str, Any]:
    """Play a card (user's turn)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game_doc = await db.bid_whist_practice.find_one(
        {"user_id": current_user.user_id, "status": {"$ne": "completed"}},
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    if not game_doc:
        raise HTTPException(status_code=404, detail="No active practice game")
    
    game = BidWhistGame()
    game.load_state(game_doc)
    
    # Play user's card and CAPTURE the event for the play_sequence so the
    # frontend can stage reveals (Spades AAA pattern).
    user_result = game.play_card("south", data.card)
    if user_result.get("error"):
        raise HTTPException(status_code=400, detail=user_result["error"])
    play_sequence: List[Dict[str, Any]] = [{
        "player": "south",
        "card": data.card,
        "trick_complete": bool(user_result.get("trick_complete")),
        "trick_winner": user_result.get("trick_winner"),
    }]

    # Process AI turns automatically — each AI play is appended to play_sequence.
    await process_ai_turns(game, db, game_doc["game_id"], play_sequence=play_sequence)
    
    # Save
    updated_data = game.save_state()
    await db.bid_whist_practice.update_one(
        {"game_id": game_doc["game_id"]},
        {"$set": updated_data}
    )
    
    client_state = game.get_client_state(current_user.user_id)
    client_state["game_id"] = game_doc["game_id"]
    client_state["play_sequence"] = play_sequence
    
    return {
        "success": True,
        "game": client_state
    }


async def process_ai_turns(
    game: BidWhistGame,
    db,
    game_id: str,
    play_sequence: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Process all AI turns automatically.

    BidWhistGame doesn't expose a single `whose_turn` attribute — it varies by
    phase. This helper computes the next AI position per phase and steps
    through up to N iterations until the next move belongs to the human user
    or a phase transitions.

    When `play_sequence` is provided, each AI card play is appended as
    {player, card, trick_complete, trick_winner} so the frontend can
    stage the reveals one-by-one (matches Spades AAA pattern).
    """
    AI_POSITIONS = {"north", "east", "west"}
    BID_ORDER = ['north', 'east', 'south', 'west']
    max_iterations = 20  # Prevent infinite loops
    iterations = 0

    def next_position() -> Optional[str]:
        """Whose turn is it next, given the current phase?"""
        if game.game_phase == "bidding":
            # During bidding, every seat bids exactly once. Find the first
            # position in BID_ORDER that hasn't bid yet.
            already_bid = {b['player'] for b in game.bids}
            for pos in BID_ORDER:
                if pos not in already_bid:
                    return pos
            return None
        if game.game_phase == "kitty_exchange":
            return game.bid_winner
        if game.game_phase == "playing":
            if not game.current_trick:
                return getattr(game, 'trick_leader', None) or game.bid_winner
            played = len(game.current_trick)
            if played >= 4:
                return None
            last_pos = game.current_trick[-1].get('player')
            if last_pos in BID_ORDER:
                return BID_ORDER[(BID_ORDER.index(last_pos) + 1) % 4]
        return None

    while iterations < max_iterations:
        iterations += 1
        position = next_position()
        if not position or position not in AI_POSITIONS:
            break

        if game.game_phase == "bidding":
            current_highest = game.winning_bid["amount"] if game.winning_bid else None
            bid_amount, bid_type, _ = ai.decide_bid(
                game.players[position]["hand"],
                current_highest
            )
            if bid_amount is None:
                # AI passes — append non-winning record (same logic as user pass).
                game.bids.append({'player': position, 'amount': 0, 'type': 'pass', 'value': -1})
                if len(game.bids) >= 4:
                    real_bids = [b for b in game.bids if b['type'] != 'pass']
                    if real_bids:
                        winning = max(real_bids, key=lambda b: b['value'])
                        game.winning_bid = winning
                        game.bid_winner = winning['player']
                        game.bid_type = winning['type']
                        game.game_phase = 'kitty_exchange'
            else:
                game.place_bid(position, bid_amount, bid_type)

        elif game.game_phase == "kitty_exchange":
            # AI exchanges kitty
            if game.bid_winner == position:
                trump_suit = game.trump_suit or "spades"
                discards = ai.choose_kitty_discards(game.players[position]["hand"], trump_suit)
                game.exchange_kitty(position, trump_suit, discards)

        elif game.game_phase == "playing":
            hand = game.players[position]["hand"]
            card_to_play = ai.choose_card_to_play(
                hand, game.current_trick, game.trump_suit, game.led_suit
            )
            if card_to_play:
                result = game.play_card(position, card_to_play)
                if play_sequence is not None:
                    play_sequence.append({
                        "player": position,
                        "card": card_to_play,
                        "trick_complete": bool(result.get("trick_complete")),
                        "trick_winner": result.get("trick_winner"),
                    })
            else:
                break  # AI couldn't choose a card — bail to avoid infinite loop.

    # Save after all AI moves
    updated_data = game.save_state()
    await db.bid_whist_practice.update_one(
        {"game_id": game_id},
        {"$set": updated_data}
    )
