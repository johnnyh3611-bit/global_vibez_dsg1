from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from typing import List, Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from utils.bid_whist_game import BidWhistGame, get_bid_whist_ai_bid, get_bid_whist_ai_play
from utils.game_forfeit import handle_player_quit
from datetime import datetime, timezone
import uuid
import asyncio

router = APIRouter(prefix="/bid-whist", tags=["bid_whist"])


# ==================== AI DEALER REACTION SYSTEM ====================

async def process_ai_dealer_reaction(game_id: str, db) -> Dict[str, Any]:
    """
    Triggers AI Dealer (Nova/Ace) to react to big plays in the Celestial Glasshouse.
    This runs without blocking the game so the AI feels "Human".
    """
    await asyncio.sleep(0.5)  # Brief delay for realism
    
    # Import here to avoid circular dependency
    from websocket_server import sio
    
    game_doc = await db.bid_whist_games.find_one({"game_id": game_id}, {"_id": 0})
    if not game_doc:
        return
    
    # Determine dealer reaction based on game state
    reactions = [
        {"action": "DEAL_SINGLE_CARD", "message": "Smooth play!"},
        {"action": "CHEER", "message": "Big move!"},
        {"action": "NOD", "message": "Well played."},
        {"action": "SHUFFLE", "message": "Let's see what happens..."}
    ]
    
    # Pick a random reaction
    import secrets
    reaction = secrets.choice(reactions)
    
    # Emit to all players in the game room
    await sio.emit("dealer_reaction", reaction, room=game_id)


async def process_ai_plays(game_id: str, db) -> Dict[str, Any]:
    """Process AI player card plays automatically"""
    await asyncio.sleep(1)  # Brief delay for realism
    
    game_doc = await db.bid_whist_games.find_one({"game_id": game_id}, {"_id": 0})
    if not game_doc or game_doc["phase"] != "playing":
        return
    
    # Reconstruct game
    game = BidWhistGame()
    game.players = game_doc["players_data"]
    game.current_trick = game_doc.get("current_trick", [])
    game.trump_suit = game_doc.get("trump_suit")
    game.tricks_won = game_doc.get("tricks_won", {"team1": 0, "team2": 0})
    
    # Determine whose turn it is
    play_order = ['north', 'east', 'south', 'west']
    trick_leader = game_doc.get("trick_leader", "north")
    leader_idx = play_order.index(trick_leader)
    
    # Rotate play order based on leader
    current_play_order = play_order[leader_idx:] + play_order[:leader_idx]
    
    # Find next player to play
    cards_played = len(game.current_trick)
    if cards_played >= 4:
        return  # Trick complete
    
    next_position = current_play_order[cards_played]
    
    # Check if next player is AI
    player_id = game_doc["player_mapping"].get(next_position, "")
    if player_id and not player_id.startswith("AI_"):
        return  # Human player's turn
    
    # Get AI card to play
    ai_hand = game.players[next_position]['hand']
    led_suit = game.current_trick[0]['suit'] if game.current_trick else None
    
    ai_card = get_bid_whist_ai_play(
        hand=ai_hand,
        current_trick=game.current_trick,
        led_suit=led_suit,
        trump_suit=game.trump_suit
    )
    
    # Play the card
    game.current_trick.append({
        'player': next_position,
        'card': ai_card,
        'suit': ai_card['suit'],
        'value': ai_card['value']
    })
    
    # Remove card from AI hand
    game.players[next_position]['hand'] = [
        c for c in ai_hand if not (c['suit'] == ai_card['suit'] and c['value'] == ai_card['value'])
    ]
    
    # Check if trick is complete (4 cards played)
    if len(game.current_trick) == 4:
        # Determine winner
        winner_pos = determine_trick_winner(
            game.current_trick,
            led_suit,
            game.trump_suit,
            bid_direction=getattr(game, "bid_direction", None) or game_doc.get("bid_direction", "uptown"),
        )
        winner_team = game.players[winner_pos]['team']
        game.tricks_won[winner_team] += 1
        
        # Update database with trick completion
        await db.bid_whist_games.update_one(
            {"game_id": game_id},
            {"$set": {
                "current_trick": [],
                "trick_leader": winner_pos,
                "tricks_won": game.tricks_won,
                "players_data": game.players,
                "last_trick": game.current_trick
            }}
        )
        
        # Check if all 13 tricks played (game over)
        total_tricks = game.tricks_won["team1"] + game.tricks_won["team2"]
        if total_tricks >= 13:
            # Game complete - determine winner
            await db.bid_whist_games.update_one(
                {"game_id": game_id},
                {"$set": {"phase": "completed", "status": "completed"}}
            )
            return
        
        # Start next trick with AI if winner is AI
        if game_doc["player_mapping"].get(winner_pos, "").startswith("AI_"):
            await process_ai_plays(game_id, db)
    else:
        # Update with current trick
        await db.bid_whist_games.update_one(
            {"game_id": game_id},
            {"$set": {
                "current_trick": game.current_trick,
                "players_data": game.players
            }}
        )
        
        # Continue AI plays if next player is also AI
        await process_ai_plays(game_id, db)


def determine_trick_winner(
    trick: list,
    led_suit: str,
    trump_suit: str,
    bid_direction: str = "uptown",
) -> str:
    """Determine winner of a trick.

    Delegates to `services.sovereign_validator.calculate_winner` so Joker
    Power Indexing (Big=100 / Little=90) + Uptown/Downtown ranking +
    No-Trump inertia all come from a single canonical source
    (per `Global_Vibez_Sovereign_Game_Logic_Fix.pdf`).
    """
    from services.sovereign_validator import calculate_winner  # noqa: PLC0415
    if not trick:
        return None
    is_nt = (str(trump_suit or "").lower() in {"", "no_trump", "none", "nt"})
    winning_play = calculate_winner(
        trick,
        trump_suit=None if is_nt else trump_suit,
        led_suit=led_suit,
        bid_direction=bid_direction,
        is_no_trump=is_nt,
    )
    if not winning_play:
        return None
    return winning_play.get("player") or winning_play.get("player_id")


# ==================== AI HELPER FUNCTIONS ====================

async def process_ai_bids(game_id: str, db) -> Dict[str, Any]:
    """Process AI player bids automatically"""
    await asyncio.sleep(1)  # Brief delay for realism
    
    game_doc = await db.bid_whist_games.find_one({"game_id": game_id}, {"_id": 0})
    if not game_doc or game_doc["phase"] != "bidding":
        return
    
    # Reconstruct game
    game = BidWhistGame()
    game.players = game_doc["players_data"]
    game.bids = game_doc.get("bids", [])
    game.kitty = game_doc.get("kitty", [])
    
    # Check if all 4 players have bid
    if len(game.bids) >= 4:
        return  # Bidding complete
    
    # Find next AI player to bid
    bid_order = ['north', 'east', 'south', 'west']
    num_bids = len(game.bids)
    next_position = bid_order[num_bids]
    
    # Check if next player is AI (not in player_mapping or is AI marker)
    player_id = game_doc["player_mapping"].get(next_position, "")
    if player_id and not player_id.startswith("AI_"):
        return  # Human player's turn, wait for them
    
    # Get AI bid
    ai_hand = game.players[next_position]['hand']
    ai_bid_decision = get_bid_whist_ai_bid(ai_hand)
    
    # Place AI bid
    if ai_bid_decision['amount'] == 0:
        game.bids.append({'player': next_position, 'amount': 0, 'type': 'pass', 'value': 0})
    else:
        game.place_bid(next_position, ai_bid_decision['amount'], ai_bid_decision['type'])
    
    # Update game
    await db.bid_whist_games.update_one(
        {"game_id": game_id},
        {"$set": {
            "bids": game.bids,
            "phase": game.game_phase,
            "winning_bid": game.winning_bid,
            "bid_winner": game.bid_winner,
            "bid_type": game.bid_type
        }}
    )
    
    # Recursively process next AI bid if needed
    if len(game.bids) < 4:
        await process_ai_bids(game_id, db)


# ==================== MODELS ====================

class StartBidWhistGame(BaseModel):
    partner_id: str
    opponent1_id: str
    opponent2_id: str
    wager: int = 0
    winning_score: int = 7  # 7 or 11


class BidWhistBid(BaseModel):
    game_id: str
    amount: int  # 3-7 or 0 for pass
    bid_type: str  # 'uptown', 'downtown', 'no_trump'


class BidWhistKittyExchange(BaseModel):
    game_id: str
    trump_suit: str  # 'spades', 'hearts', 'diamonds', 'clubs', or 'no_trump'
    discards: List[Dict]  # 6 cards to discard


class BidWhistPlay(BaseModel):
    game_id: str
    card: Dict


# ==================== ENDPOINTS ====================

@router.post("/start")
async def start_bid_whist_game(game_data: StartBidWhistGame, request: Request, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Start a new Bid Whist game"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Create game
    game = BidWhistGame(winning_score=game_data.winning_score)
    game.deal_cards()
    
    # Map players (use AI for missing players)
    player_mapping = {
        'north': current_user.user_id,
        'south': game_data.partner_id if game_data.partner_id else "AI_SOUTH",
        'east': game_data.opponent1_id if game_data.opponent1_id else "AI_EAST",
        'west': game_data.opponent2_id if game_data.opponent2_id else "AI_WEST"
    }
    
    # Create game document
    game_doc = {
        "game_id": f"bidwhist_{uuid.uuid4().hex[:12]}",
        "game_type": "bid_whist",
        "player_mapping": player_mapping,
        "dealer": "south",  # Dealer position (rotates each hand, dealer bids last)
        "players_data": {
            pos: {
                'hand': player['hand'],
                'team': player['team']
            } for pos, player in game.players.items()
        },
        "scores": game.scores,
        "tricks_won": game.tricks_won,
        "kitty": game.kitty,
        "phase": game.game_phase,
        "bids": game.bids,
        "current_trick": game.current_trick,
        "wager": game_data.wager,
        "pot": game_data.wager * 4,
        "winning_score": game_data.winning_score,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "active"
    }
    
    await db.bid_whist_games.insert_one(game_doc)
    
    # Get user's hand
    user_position = [pos for pos, uid in player_mapping.items() if uid == current_user.user_id][0]
    user_hand = game.players[user_position]['hand']
    
    # ALWAYS start AI bidding task - it will check if next player is AI
    background_tasks.add_task(process_ai_bids, game_doc["game_id"], db)
    
    return {
        "game_id": game_doc["game_id"],
        "message": "Bid Whist game started! Place your bids.",
        "your_position": user_position,
        "your_hand": user_hand,
        "phase": "bidding",
        "winning_score": game_data.winning_score,
        "wager": game_data.wager,
        "ai_players": [pos for pos, uid in player_mapping.items() if uid.startswith("AI_")]
    }


@router.post("/bid")
async def place_bid_whist_bid(bid_data: BidWhistBid, request: Request, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Place a bid"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game_doc = await db.bid_whist_games.find_one({"game_id": bid_data.game_id}, {"_id": 0})
    if not game_doc:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Reconstruct game
    game = BidWhistGame()
    game.players = game_doc["players_data"]
    game.scores = game_doc["scores"]
    game.game_phase = game_doc["phase"]
    game.bids = game_doc.get("bids", [])
    game.kitty = game_doc.get("kitty", [])
    
    # Find user position
    user_position = [pos for pos, uid in game_doc["player_mapping"].items() if uid == current_user.user_id][0]
    
    # Place bid
    if bid_data.amount == 0:
        # Pass
        game.bids.append({'player': user_position, 'amount': 0, 'type': 'pass', 'value': 0})
    else:
        success = game.place_bid(user_position, bid_data.amount, bid_data.bid_type)
        if not success:
            raise HTTPException(status_code=400, detail="Invalid bid")
    
    # Update game
    await db.bid_whist_games.update_one(
        {"game_id": bid_data.game_id},
        {"$set": {
            "bids": game.bids,
            "phase": game.game_phase,
            "winning_bid": game.winning_bid,
            "bid_winner": game.bid_winner,
            "bid_type": game.bid_type
        }}
    )
    
    # Trigger AI bids in background
    if len(game.bids) < 4:
        background_tasks.add_task(process_ai_bids, bid_data.game_id, db)
    
    return {
        "message": f"Bid placed: {bid_data.amount} {bid_data.bid_type}" if bid_data.amount > 0 else "Passed",
        "phase": game.game_phase,
        "winning_bid": game.winning_bid,
        "bid_winner": game.bid_winner
    }


@router.post("/kitty")
async def exchange_kitty(exchange_data: BidWhistKittyExchange, request: Request) -> Dict[str, Any]:
    """Exchange kitty and declare trump"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game_doc = await db.bid_whist_games.find_one({"game_id": exchange_data.game_id}, {"_id": 0})
    if not game_doc:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Reconstruct game
    game = BidWhistGame()
    game.players = game_doc["players_data"]
    game.kitty = game_doc["kitty"]
    game.bid_winner = game_doc["bid_winner"]
    game.bid_type = game_doc["bid_type"]
    
    user_position = [pos for pos, uid in game_doc["player_mapping"].items() if uid == current_user.user_id][0]
    
    # Exchange kitty
    success = game.exchange_kitty(user_position, exchange_data.trump_suit, exchange_data.discards)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid kitty exchange")
    
    # Update game
    await db.bid_whist_games.update_one(
        {"game_id": exchange_data.game_id},
        {"$set": {
            "players_data": {
                pos: {'hand': p['hand'], 'team': p['team']}
                for pos, p in game.players.items()
            },
            "trump_suit": game.trump_suit,
            "phase": game.game_phase
        }}
    )
    
    return {
        "message": f"Trump set to {exchange_data.trump_suit}",
        "phase": game.game_phase,
        "trump_suit": game.trump_suit
    }


@router.post("/play")
async def play_card_bid_whist(play_data: BidWhistPlay, request: Request, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Play a card - AAA Refactored with State Management"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game_doc = await db.bid_whist_games.find_one({"game_id": play_data.game_id}, {"_id": 0})
    if not game_doc:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Initialize Engine with DB data (NEW: Using load_state helper)
    game = BidWhistGame(play_data.game_id)
    game.load_state(game_doc)
    
    # Find user position
    user_position = [pos for pos, uid in game_doc["player_mapping"].items() if uid == current_user.user_id][0]
    
    # Execute Move
    result = game.play_card(user_position, play_data.card)
    
    # Handle winnings if game finished — Sovereign Tax applies pre-credit
    # per `Global_Vibez_Sovereign_Game_Logic_Fix.pdf` directive E.
    if game.game_phase == 'finished' and game_doc.get("wager", 0) > 0:
        from services.card_game_payouts import settle_taxable_payout  # noqa: PLC0415
        pot = game_doc["pot"]
        winning_team = game.winner

        winners = [uid for pos, uid in game_doc["player_mapping"].items()
                  if game.players[pos]['team'] == winning_team]

        gross_per_player = pot // max(1, len(winners))
        for winner_id in winners:
            await settle_taxable_payout(
                db,
                user_id=winner_id,
                gross=gross_per_player,
                tx_type="bid_whist_winnings",
                game_id=play_data.game_id,
                description=f"🏆 Won Bid Whist — gross {gross_per_player} ₵",
            )
    
    # Update DB with the NEW state (Using save_state helper)
    await db.bid_whist_games.update_one(
        {"game_id": play_data.game_id},
        {"$set": game.save_state()}
    )
    
    # Trigger AI plays in background if game still active
    if game.game_phase == 'playing':
        background_tasks.add_task(process_ai_plays, play_data.game_id, db)

    # Trigger "Perfect Dealer" response if trick ends
    if result.get('trick_complete'):
        background_tasks.add_task(process_ai_dealer_reaction, play_data.game_id, db)

    # Stamp the turn-start timestamp so the 15s watchdog can fire
    # (PDF-B: FORCE_AUTO_PLAY). Non-fatal — never crash on timer issues.
    try:
        from routes.turn_timer import stamp_turn_start  # noqa: PLC0415
        await stamp_turn_start(db, "bid_whist", play_data.game_id)
    except Exception:
        pass

    return {
        "status": "success",
        "new_state": game.get_client_state(current_user.user_id),
        "trick_winner": result.get("trick_winner"),
        "trick_complete": result.get("trick_complete")
    }


@router.get("/game/{game_id}")
async def get_bid_whist_game(game_id: str, request: Request) -> Dict[str, Any]:
    """Get game state"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game_doc = await db.bid_whist_games.find_one({"game_id": game_id}, {"_id": 0})
    if not game_doc:
        raise HTTPException(status_code=404, detail="Game not found")
    
    user_position = [pos for pos, uid in game_doc["player_mapping"].items() if uid == current_user.user_id][0]
    user_hand = game_doc["players_data"][user_position]["hand"]
    
    # Show kitty only if in kitty_exchange phase and user is bid winner
    kitty = None
    if game_doc["phase"] == "kitty_exchange" and user_position == game_doc.get("bid_winner"):
        kitty = game_doc.get("kitty", [])
    
    # Build players_data for display (hide other players' hands)
    players_data = {}
    for pos, data in game_doc["players_data"].items():
        players_data[pos] = {
            "team": data["team"],
            "card_count": len(data["hand"])
        }
    
    # Calculate whose turn it is to bid
    bid_order = ['north', 'east', 'south', 'west']
    num_bids = len(game_doc.get("bids", []))
    current_bidder = bid_order[num_bids] if num_bids < 4 else None
    
    return {
        "game_id": game_id,
        "your_position": user_position,
        "your_hand": user_hand,
        "kitty": kitty,
        "dealer": game_doc.get("dealer", "south"),
        "phase": game_doc["phase"],
        "scores": game_doc["scores"],
        "tricks_won": game_doc["tricks_won"],
        "current_trick": game_doc["current_trick"],
        "winning_bid": game_doc.get("winning_bid"),
        "trump_suit": game_doc.get("trump_suit"),
        "status": game_doc["status"],
        "players_data": players_data,
        "bids": game_doc.get("bids", []),
        "current_bidder": current_bidder,
        "whose_turn": current_bidder,
        "is_your_turn": current_bidder == user_position
    }



# ==================== FORFEIT/QUIT SYSTEM ====================

class QuitGameRequest(BaseModel):
    game_id: str


@router.post("/quit")
async def quit_game(req: QuitGameRequest, request: Request) -> Dict[str, Any]:
    """
    Handle player quitting/leaving game mid-match
    - Applies 15% penalty if game is in progress
    - Records forfeit in database
    - Redistributes entry fees to remaining players
    """
    db = get_database()
    user_id = await get_current_user(request)
    
    # Get game
    game = await db.bid_whist_games.find_one({"game_id": req.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check if user is in this game
    player_mapping = game.get("player_mapping", {})
    user_position = None
    for pos, pid in player_mapping.items():
        if pid == user_id:
            user_position = pos
            break
    
    if not user_position:
        raise HTTPException(status_code=403, detail="You are not in this game")
    
    # Handle forfeit penalty
    forfeit_result = await handle_player_quit(
        user_id=user_id,
        game_id=req.game_id,
        game_type="bid_whist"
    )
    
    # Mark player as quit in game
    await db.bid_whist_games.update_one(
        {"game_id": req.game_id},
        {
            "$set": {
                f"players_quit.{user_position}": True,
                f"quit_timestamps.{user_position}": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # If game was in progress, notify other players via WebSocket
    if game.get("status") in ["active", "in_progress", "playing"]:
        from websocket_server import sio
        await sio.emit("player_quit", {
            "position": user_position,
            "user_id": user_id,
            "penalty_applied": forfeit_result.get("penalty_applied", True),
            "message": f"Player {user_position} has quit the game"
        }, room=req.game_id)
    
    # Check if game should end (too few players)
    players_quit = len([v for v in game.get("players_quit", {}).values() if v])
    total_players = len(player_mapping)
    remaining_players = total_players - players_quit
    
    if remaining_players < 2:
        # End game - not enough players
        await db.bid_whist_games.update_one(
            {"game_id": req.game_id},
            {
                "$set": {
                    "status": "ended",
                    "end_reason": "insufficient_players",
                    "ended_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
    
    return {
        "success": True,
        "forfeit_result": forfeit_result,
        "remaining_players": remaining_players,
        "message": "You have left the game" + (f" - {forfeit_result.get('message', '')}" if forfeit_result.get("penalty_applied") else "")
    }

