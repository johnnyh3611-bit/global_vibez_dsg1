"""
Bid Whist Game Routes
Handles kitty claiming, burying, and Uptown/Downtown logic.

May 2026 — migrated from in-memory ``BID_WHIST_GAMES`` dict to Mongo
collection ``bid_whist_games`` so in-flight games survive backend
restarts. Same wire shape; idempotent for callers.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from services.game_evaluators import BidWhistEvaluator, Card
from utils.database import get_database

router = APIRouter()


def _games():
    """Helper — Mongo collection holding in-flight Bid Whist games."""
    return get_database().bid_whist_games


async def _load_game(table_id: str) -> Dict[str, Any]:
    g = await _games().find_one({"table_id": table_id}, {"_id": 0})
    if not g:
        raise HTTPException(status_code=404, detail="Game not found")
    return g


class KittyClaimRequest(BaseModel):
    table_id: str
    player_id: str

class BuryCardsRequest(BaseModel):
    table_id: str
    player_id: str
    discards: List[str]  # List of card strings like ["5H", "KS", "2D"]

class PlayCardRequest(BaseModel):
    table_id: str
    player_id: str
    card: str

# ============================================================================
# KITTY MANAGEMENT
# ============================================================================

@router.post("/bid-whist/{table_id}/claim-kitty")
async def claim_kitty(table_id: str, request: KittyClaimRequest) -> Dict[str, Any]:
    """Claim the kitty cards (winner of bidding gets the 6 hidden cards)."""
    game = await _load_game(table_id)
    if game.get("winning_bidder") != request.player_id:
        raise HTTPException(status_code=403, detail="You are not the winning bidder")

    kitty_cards = game.get("kitty_cards", [])
    return {
        "success": True,
        "kitty_cards": kitty_cards,
        "message": f"You claimed the kitty. You now have {len(kitty_cards) + 12} cards. Bury 6 cards to continue."
    }


@router.post("/bid-whist/{table_id}/bury-cards")
async def bury_cards(table_id: str, request: BuryCardsRequest) -> Dict[str, Any]:
    """Bury 6 cards back to the kitty (winning bidder discards 6 to return to a 12-card hand)."""
    game = await _load_game(table_id)
    if game.get("winning_bidder") != request.player_id:
        raise HTTPException(status_code=403, detail="Only the bidder can bury cards")
    if len(request.discards) != 6:
        raise HTTPException(
            status_code=400,
            detail=f"Must bury exactly 6 cards. You provided {len(request.discards)}",
        )
    await _games().update_one(
        {"table_id": table_id},
        {"$set": {
            "buried_cards": request.discards,
            "kitty_buried": True,
            "phase": "PLAYING",
        }},
    )
    return {
        "success": True,
        "status": "success",
        "message": "Kitty buried. Game starting.",
        "buried_cards": request.discards,
    }


# ============================================================================
# TRICK EVALUATION
# ============================================================================

@router.post("/bid-whist/{table_id}/play-card")
async def play_card(table_id: str, request: PlayCardRequest) -> Dict[str, Any]:
    """Play a card and evaluate the trick."""
    game = await _load_game(table_id)

    try:
        card = Card.from_string(request.card)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid card format: {str(e)}")

    # Build current trick (cards stored as [card_str, player_id] in Mongo).
    current_trick = game.get("current_trick", []) or []
    lead_suit = game.get("lead_suit") or card.suit
    current_trick.append([request.card, request.player_id])

    if len(current_trick) < 4:
        # Trick still in progress — persist + return.
        await _games().update_one(
            {"table_id": table_id},
            {"$set": {"current_trick": current_trick, "lead_suit": lead_suit}},
        )
        return {
            "trick_complete": False,
            "cards_in_trick": len(current_trick),
            "waiting_for": 4 - len(current_trick),
        }

    # Trick complete — evaluate.
    parsed = [(Card.from_string(c), pid) for c, pid in current_trick]
    winner = BidWhistEvaluator.evaluate_trick(
        cards_played=parsed,
        trump_suit=game.get("trump_suit"),
        bid_type=game.get("bid_type", "UPTOWN"),
        lead_suit=lead_suit,
    )
    tricks_won = game.get("tricks_won", {}) or {}
    tricks_won[winner] = int(tricks_won.get(winner, 0)) + 1

    await _games().update_one(
        {"table_id": table_id},
        {"$set": {
            "current_trick": [],
            "lead_suit": None,
            "current_leader": winner,
            "tricks_won": tricks_won,
        }},
    )
    return {
        "trick_complete": True,
        "winner": winner,
        "cards_played": [c for c, _ in current_trick],
        "tricks_won": tricks_won,
    }


@router.post("/bid-whist/{table_id}/initialize")
async def initialize_game(
    table_id: str,
    bid_type: str,  # UPTOWN, DOWNTOWN, NO_TRUMP
    trump_suit: Optional[str] = None,
    winning_bidder: str = None,
    kitty_cards: List[str] = None,
) -> Dict[str, Any]:
    """Initialize a new Bid Whist game (idempotent on table_id)."""
    doc = {
        "table_id": table_id,
        "bid_type": bid_type,
        "trump_suit": trump_suit,
        "winning_bidder": winning_bidder,
        "kitty_cards": kitty_cards or [],
        "buried_cards": [],
        "kitty_buried": False,
        "current_trick": [],
        "lead_suit": None,
        "tricks_won": {},
        "phase": "KITTY_CLAIMING",
    }
    await _games().update_one({"table_id": table_id}, {"$set": doc}, upsert=True)
    return {
        "success": True,
        "game_id": table_id,
        "bid_type": bid_type,
        "message": f"Bid Whist game initialized. {bid_type} bid with {trump_suit or 'No Trump'}",
    }


@router.get("/bid-whist/{table_id}/state")
async def get_game_state(table_id: str) -> Dict[str, Any]:
    """Get current game state."""
    return await _load_game(table_id)
