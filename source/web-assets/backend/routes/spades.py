from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from utils.spades_game import (
    SpadesGame, RULESETS,
)
from services.sovereign_game_logic import (
    POWER_MATRIX,
    TRUMP_PRIORITY_BONUS,
    VALID_BID_TYPES,
    get_card_power,
    hot_card_alert,
    bounty_warning,
    TieContender,
)
from datetime import datetime, timezone
import uuid

router = APIRouter(prefix="/spades", tags=["spades"])


# ==================== MODELS ====================

class StartSpadesGame(BaseModel):
    partner_id: str  # Your teammate
    opponent1_id: str  # Opponent 1
    opponent2_id: str  # Opponent 2
    wager: int = 0  # Optional credit wager
    ruleset: str = "CLASSIC"  # "CLASSIC" or "BIG_WHEEL"


class SpadesBid(BaseModel):
    game_id: str
    bid: int  # 0-13


class SpadesPlay(BaseModel):
    game_id: str
    card: Dict  # {suit: str, rank: str, value: int}


# ==================== ENDPOINTS ====================


@router.get("/rulesets")
async def list_spades_rulesets() -> Dict[str, Any]:
    """List the available Spades rulesets so the frontend table-creation
    UI can render the selector with house-cut info baked in.
    """
    return {
        "rulesets": [
            {
                "id": rid,
                "label": cfg["label"],
                "deck_size": cfg["deck_size"],
                "house_cut_pct": cfg["house_cut_pct"],
                "has_jokers": cfg["jokers"],
                "promoted_trumps": list(cfg["promoted_trumps"].keys()),
            }
            for rid, cfg in RULESETS.items()
        ],
    }


@router.post("/start")
async def start_spades_game(game_data: StartSpadesGame, request: Request) -> Dict[str, Any]:
    """Start a new Spades game (4 players, 2 teams)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()

    # Validate ruleset early — surfaces a clear 400 instead of a 500 deep
    # in the deck builder.
    if game_data.ruleset not in RULESETS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown ruleset '{game_data.ruleset}'. "
                   f"Choose one of: {', '.join(RULESETS)}",
        )

    # Create game instance
    game = SpadesGame(ruleset=game_data.ruleset)
    game.deal_cards()
    
    # Map players to positions
    player_mapping = {
        'north': current_user.user_id,  # You
        'south': game_data.partner_id,  # Your partner (team1)
        'east': game_data.opponent1_id,  # Opponent 1 (team2)
        'west': game_data.opponent2_id  # Opponent 2 (team2)
    }
    
    # Create game document
    game_doc = {
        "game_id": f"spades_{uuid.uuid4().hex[:12]}",
        "game_type": "spades",
        "ruleset": game.ruleset_name,
        "house_cut_pct": game.house_cut_pct,
        "player_mapping": player_mapping,
        "game_state": game.get_game_state(),
        "players_data": {
            pos: {
                'hand': player['hand'],
                'bid': player['bid'],
                'tricks': player['tricks'],
                'team': player['team']
            } for pos, player in game.players.items()
        },
        "scores": game.scores,
        "current_trick": game.current_trick,
        "phase": game.game_phase,
        "wager": game_data.wager,
        "pot": game_data.wager * 4,  # 4 players total
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.spades_games.insert_one(game_doc)
    
    # Get player's hand
    user_position = [pos for pos, uid in player_mapping.items() if uid == current_user.user_id][0]
    user_hand = game.players[user_position]['hand']
    
    return {
        "game_id": game_doc["game_id"],
        "message": "Spades game started! Place your bids.",
        "your_position": user_position,
        "your_hand": user_hand,
        "phase": "bidding",
        "wager": game_data.wager,
        "ruleset": game.ruleset_name,
        "ruleset_label": game.ruleset['label'],
        "house_cut_pct": game.house_cut_pct,
    }


@router.post("/bid")
async def place_bid(bid_data: SpadesBid, request: Request) -> Dict[str, Any]:
    """Place your bid (0-13 tricks)"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get game
    game_doc = await db.spades_games.find_one({"game_id": bid_data.game_id}, {"_id": 0})
    if not game_doc:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Reconstruct game using the persisted ruleset (default CLASSIC for
    # legacy rows that pre-date the ruleset column).
    game = SpadesGame(ruleset=game_doc.get("ruleset", "CLASSIC"))
    game.players = game_doc["players_data"]
    game.scores = game_doc["scores"]
    game.game_phase = game_doc["phase"]
    
    # Find user's position
    user_position = [pos for pos, uid in game_doc["player_mapping"].items() if uid == current_user.user_id][0]
    
    # Set bid
    game.set_bid(user_position, bid_data.bid)
    
    # Update game
    await db.spades_games.update_one(
        {"game_id": bid_data.game_id},
        {"$set": {
            "players_data": {
                pos: {
                    'hand': p['hand'],
                    'bid': p['bid'],
                    'tricks': p['tricks'],
                    'team': p['team']
                } for pos, p in game.players.items()
            },
            "phase": game.game_phase
        }}
    )
    
    return {
        "message": f"Bid placed: {bid_data.bid} tricks",
        "phase": game.game_phase,
        "team_bids": {
            "team1": game.get_team_bid('team1'),
            "team2": game.get_team_bid('team2')
        }
    }


@router.post("/play")
async def play_card(play_data: SpadesPlay, request: Request) -> Dict[str, Any]:
    """Play a card to the current trick"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get game
    game_doc = await db.spades_games.find_one({"game_id": play_data.game_id}, {"_id": 0})
    if not game_doc:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Reconstruct game with the persisted ruleset so promoted-trump scoring
    # in determine_trick_winner() respects this table's setting.
    game = SpadesGame(ruleset=game_doc.get("ruleset", "CLASSIC"))
    game.players = game_doc["players_data"]
    game.scores = game_doc["scores"]
    game.current_trick = game_doc["current_trick"]
    game.game_phase = game_doc["phase"]
    game.tricks_played = game_doc.get("tricks_played", 0)
    game.spades_broken = game_doc.get("spades_broken", False)
    
    # Find user's position
    user_position = [pos for pos, uid in game_doc["player_mapping"].items() if uid == current_user.user_id][0]
    
    # Play card
    result = game.play_card(user_position, play_data.card)
    
    # Update game
    update_data = {
        "players_data": {
            pos: {
                'hand': p['hand'],
                'bid': p['bid'],
                'tricks': p['tricks'],
                'team': p['team']
            } for pos, p in game.players.items()
        },
        "current_trick": game.current_trick,
        "tricks_played": game.tricks_played,
        "spades_broken": game.spades_broken,
        "phase": game.game_phase,
        "scores": game.scores
    }
    
    # Check if game finished
    if game.game_phase == 'finished':
        update_data["status"] = "completed"
        update_data["winner"] = game.winner
        
        # Distribute winnings if wagered. Per Sovereign Game Logic Fix PDF
        # directive E: 13.5% Sovereign Tax applies BEFORE the win animation
        # so the client always shows the post-tax number. Routes through
        # services.card_game_payouts.settle_taxable_payout for canonical
        # treasury + ambassador-dividend accounting.
        if game_doc.get("wager", 0) > 0:
            from services.card_game_payouts import settle_taxable_payout  # noqa: PLC0415
            pot = game_doc["pot"]
            winning_team = game.winner

            # Get winning team players
            winners = [uid for pos, uid in game_doc["player_mapping"].items()
                      if game.players[pos]['team'] == winning_team]

            # Split pot among winners (pre-tax gross; tax applies per-player).
            gross_per_player = pot // max(1, len(winners))
            payout_breakdown = []
            for winner_id in winners:
                settled = await settle_taxable_payout(
                    db,
                    user_id=winner_id,
                    gross=gross_per_player,
                    tx_type="spades_winnings",
                    game_id=play_data.game_id,
                    description=f"🏆 Won Spades — gross {gross_per_player} ₵, net {gross_per_player} ₵",
                )
                payout_breakdown.append({"user_id": winner_id, **settled})
            update_data["payout_breakdown"] = payout_breakdown
    
    await db.spades_games.update_one(
        {"game_id": play_data.game_id},
        {"$set": update_data}
    )

    # Stamp the turn-start timestamp for the 15s watchdog (PDF-B).
    try:
        from routes.turn_timer import stamp_turn_start  # noqa: PLC0415
        await stamp_turn_start(db, "spades", play_data.game_id)
    except Exception:
        pass

    return {
        "message": "Card played",
        "trick_winner": result.get("trick_winner"),
        "tricks_played": result["tricks_complete"],
        "scores": game.scores,
        "phase": game.game_phase,
        "winner": getattr(game, 'winner', None)
    }


@router.get("/game/{game_id}")
async def get_spades_game(game_id: str, request: Request) -> Dict[str, Any]:
    """Get current game state"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game_doc = await db.spades_games.find_one({"game_id": game_id}, {"_id": 0})
    if not game_doc:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Get user's position and hand
    user_position = [pos for pos, uid in game_doc["player_mapping"].items() if uid == current_user.user_id][0]
    user_hand = game_doc["players_data"][user_position]["hand"]
    
    return {
        "game_id": game_id,
        "your_position": user_position,
        "your_hand": user_hand,
        "phase": game_doc["phase"],
        "scores": game_doc["scores"],
        "current_trick": game_doc["current_trick"],
        "tricks_played": game_doc.get("tricks_played", 0),
        "players": game_doc["players_data"],
        "status": game_doc["status"]
    }


@router.get("/stats/{user_id}")
async def get_spades_stats(user_id: str, request: Request) -> Dict[str, Any]:
    """Get player's Spades statistics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Get all completed games for user
    games = await db.spades_games.find({
        "player_mapping": {"$elemMatch": {"$eq": user_id}},
        "status": "completed"
    }, {"_id": 0}).to_list(1000)
    
    total_games = len(games)
    wins = sum(1 for g in games if g.get("winner") == 
              next((p['team'] for pos, p in g["players_data"].items() 
                   if g["player_mapping"][pos] == user_id), None))
    
    return {
        "total_games": total_games,
        "wins": wins,
        "losses": total_games - wins,
        "win_rate": (wins / total_games * 100) if total_games > 0 else 0
    }



# ==================== SOVEREIGN UNIVERSAL TONGUE ====================
# Wired (2026-02-15): expose the canonical card-power engine + UI event
# generators from services/sovereign_game_logic.py so the Spades frontend
# (and any future pluggable AI dealer) can preview card power before play
# and trigger the "Hot Card" / "Bounty Warning" overlays in real time.

class CardPowerRequest(BaseModel):
    rank: str           # "2"-"10", "J","Q","K","A","LJ","BJ"
    suit: str = ""      # "spades"/"hearts"/"diamonds"/"clubs"/"" for jokers
    bid_type: str = "UPTOWN"   # "UPTOWN" | "DOWNTOWN"
    trump_suit: Optional[str] = "spades"


class HotCardRequest(BaseModel):
    rank: str
    suit: Optional[str] = None
    player_id: str


class BountyWarningRequest(BaseModel):
    bounty: float
    contenders: List[Dict[str, Any]]   # [{player_id, balance}]


@router.get("/sovereign/constants")
async def spades_sovereign_constants() -> Dict[str, Any]:
    """Return the canonical Universal Tongue power matrix + trump bonus.
    Frontend can render this as a paytable or preview card strength before
    play."""
    return {
        "power_matrix": POWER_MATRIX,
        "trump_priority_bonus": TRUMP_PRIORITY_BONUS,
        "valid_bid_types": list(VALID_BID_TYPES),
        "joker_ranks": ["LJ", "BJ"],
        "joker_powers": {"LJ": 90, "BJ": 100},
        "doc": (
            "DSG_Master_Sovereign_Game_Logic.pdf §I — Universal Tongue. "
            "Use POWER_MATRIX[bid_type][rank] for base power, +200 if "
            "card.suit == trump_suit (jokers excluded — they are global)."
        ),
    }


@router.post("/sovereign/card-power")
async def spades_card_power(req: CardPowerRequest) -> Dict[str, Any]:
    """Compute card power under the current bid + trump. Pure pass-through
    to services.sovereign_game_logic.get_card_power."""
    try:
        power = get_card_power(req.rank, req.suit, req.bid_type, req.trump_suit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "rank": req.rank,
        "suit": req.suit,
        "bid_type": req.bid_type,
        "trump_suit": req.trump_suit,
        "power": power,
        "is_trump": bool(req.trump_suit and req.suit == req.trump_suit and req.rank not in ("LJ", "BJ")),
        "is_joker": req.rank in ("LJ", "BJ"),
    }


@router.post("/sovereign/hot-card-alert")
async def spades_hot_card_alert(req: HotCardRequest) -> Dict[str, Any]:
    """Generate the WebSocket payload for the Hot Card overlay (Joker /
    Ace / King). Returns the canonical event dict ready to broadcast."""
    return hot_card_alert(req.rank, req.suit, req.player_id)


@router.post("/sovereign/bounty-warning")
async def spades_bounty_warning(req: BountyWarningRequest) -> Dict[str, Any]:
    """Generate the 'Match $X.XX or Bankrupt!' banner payload from the
    canonical bounty_warning event. Used during overtime/tie shoot-outs."""
    contenders = [TieContender(player_id=c["player_id"], balance=float(c.get("balance", 0)))
                  for c in req.contenders]
    return bounty_warning(req.bounty, contenders)
