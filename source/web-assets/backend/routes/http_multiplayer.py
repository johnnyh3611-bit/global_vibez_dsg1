"""
Pure HTTP Multiplayer System (No Socket.IO)
Works with standard REST APIs only - no WebSocket needed!
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
import uuid
import secrets
secure_random = secrets.SystemRandom()

router = APIRouter()

# In-memory storage (in production, use Redis or MongoDB)
# This works within Emergent's infrastructure!
active_games: Dict[str, Dict] = {}
matchmaking_queue: Dict[str, List[Dict]] = {}  # game_type -> list of players
player_sessions: Dict[str, Dict] = {}  # session_id -> player data

# Session timeout (5 minutes)
SESSION_TIMEOUT = timedelta(minutes=5)


# ─────────── Florida-Flow Renegade Check ───────────
def _spades_renegade_check(
    prior_state: Dict[str, Any],
    next_state: Dict[str, Any],
    player_role: str,
) -> Optional[str]:
    """
    Server-side authority for Spades trick rules.

    Returns an error string if the move is illegal, else None.

    Rules enforced:
      • The card the player is "playing" must come out of THEIR hand
        (not just be a new entry on `current_trick`).
      • If the trick already has a lead suit AND the player holds a card
        of that suit, they cannot bail to another suit (Renegade).
      • A spade can't be led until spades are broken, unless it's the only
        suit the player has left.
    """
    prior_hand = (prior_state.get("hands") or {}).get(player_role, []) or []
    next_hand = (next_state.get("hands") or {}).get(player_role, []) or []
    next_trick = next_state.get("current_trick") or []
    prior_trick = prior_state.get("current_trick") or []

    # Identify the card the player just played (delta between hands).
    played_now = next(
        (e for e in (next_trick or []) if e not in (prior_trick or [])),
        None,
    )
    if not played_now:
        # Non-trick mutation (bidding etc.) — out of scope.
        return None
    card = played_now.get("card") if isinstance(played_now, dict) else None
    if not card or len(card) < 2:
        return "malformed card"
    suit = card[-1]

    # 1. The card must actually have left the player's prior hand.
    if card in next_hand:
        return "card still in hand"
    if card not in prior_hand:
        return "card was not in your hand"
    # 2. Lead-suit follow check.
    lead_suit = None
    if prior_trick:
        first = prior_trick[0]
        first_card = first.get("card") if isinstance(first, dict) else None
        if first_card and len(first_card) >= 2:
            lead_suit = first_card[-1]
    if lead_suit and suit != lead_suit:
        # Did the player still hold a lead-suit card before this play?
        held_lead_suit = any(c.endswith(lead_suit) for c in prior_hand)
        if held_lead_suit:
            return f"must follow {lead_suit} (you held one)"
    # 3. Spades-broken check (only when leading).
    if not lead_suit and suit == "S" and not prior_state.get("spades_broken"):
        only_spades_left = all(c.endswith("S") for c in prior_hand)
        if not only_spades_left:
            return "spades not broken yet"
    return None


# Models
class JoinMatchmakingRequest(BaseModel):
    game_type: str
    user_id: str
    user_name: str

class MatchmakingStatus(BaseModel):
    in_queue: bool
    match_found: bool
    game_id: Optional[str] = None
    opponent_name: Optional[str] = None

class MakeMoveRequest(BaseModel):
    game_id: str
    move: Dict
    new_game_state: Dict

class GameState(BaseModel):
    game_id: str
    game_type: str
    status: str  # waiting, playing, completed
    player1: Dict
    player2: Optional[Dict]
    current_turn: str  # player1 or player2
    game_state: Dict
    last_updated: str
    winner: Optional[str] = None

# Helper functions
def cleanup_expired_sessions():
    """Remove expired player sessions"""
    now = datetime.now(timezone.utc)
    expired = []
    
    for session_id, data in player_sessions.items():
        last_seen = datetime.fromisoformat(data['last_seen'])
        if now - last_seen > SESSION_TIMEOUT:
            expired.append(session_id)
    
    for session_id in expired:
        # Remove from matchmaking queue
        for game_type in matchmaking_queue:
            matchmaking_queue[game_type] = [
                p for p in matchmaking_queue[game_type]
                if p['session_id'] != session_id
            ]
        # Remove from active games
        for game_id, game in list(active_games.items()):
            if (game['player1']['session_id'] == session_id or 
                (game['player2'] and game['player2']['session_id'] == session_id)):
                if game['status'] == 'playing':
                    game['status'] = 'abandoned'
        
        del player_sessions[session_id]

def get_session_id(user_id: str) -> str:
    """Get or create session for user"""
    # Find existing session
    for session_id, data in player_sessions.items():
        if data['user_id'] == user_id:
            data['last_seen'] = datetime.now(timezone.utc).isoformat()
            return session_id
    
    # Create new session
    session_id = str(uuid.uuid4())
    player_sessions[session_id] = {
        'user_id': user_id,
        'last_seen': datetime.now(timezone.utc).isoformat()
    }
    return session_id

# Endpoints

@router.post("/http-multiplayer/join-queue")
async def join_matchmaking_queue(request: JoinMatchmakingRequest) -> Dict[str, Any]:
    """
    Join matchmaking queue (replaces Socket.IO join_matchmaking)
    Client polls /check-match to see if opponent found
    """
    cleanup_expired_sessions()
    
    session_id = get_session_id(request.user_id)
    
    # Initialize queue for game type if needed
    if request.game_type not in matchmaking_queue:
        matchmaking_queue[request.game_type] = []
    
    # Check if player already in queue
    in_queue = any(p['session_id'] == session_id for p in matchmaking_queue[request.game_type])
    
    if not in_queue:
        player_data = {
            'session_id': session_id,
            'user_id': request.user_id,
            'name': request.user_name,
            'joined_at': datetime.now(timezone.utc).isoformat()
        }
        matchmaking_queue[request.game_type].append(player_data)
    
    # Try to find a match immediately
    queue = matchmaking_queue[request.game_type]
    
    # Determine required players based on game type
    required_players = 4 if request.game_type == 'spades' else 2
    
    if len(queue) >= required_players:
        # Match found! Create game
        player1 = queue.pop(0)
        player2 = queue.pop(0)
        player3 = queue.pop(0) if required_players >= 3 else None
        player4 = queue.pop(0) if required_players >= 4 else None
        
        game_id = str(uuid.uuid4())[:8]
        
        # Initialize game-specific state
        game_state = initialize_game_state(request.game_type)
        
        # Build game object
        game_obj = {
            'game_id': game_id,
            'game_type': request.game_type,
            'status': 'bidding' if request.game_type == 'spades' else 'playing',
            'player1': player1,
            'player2': player2,
            'current_turn': 'player1',
            'game_state': game_state,
            'last_updated': datetime.now(timezone.utc).isoformat(),
            'winner': None
        }
        
        # Add player3 and player4 for 4-player games
        if player3:
            game_obj['player3'] = player3
        if player4:
            game_obj['player4'] = player4
        
        active_games[game_id] = game_obj
        
        return {
            'success': True,
            'match_found': True,
            'game_id': game_id,
            'session_id': session_id
        }
    
    return {
        'success': True,
        'match_found': False,
        'session_id': session_id,
        'queue_position': len(queue)
    }

@router.get("/http-multiplayer/check-match/{user_id}")
async def check_match_status(user_id: str, game_type: str) -> Dict[str, Any]:
    """
    Check if match has been found (client polls this every 2 seconds)
    """
    cleanup_expired_sessions()
    
    session_id = get_session_id(user_id)
    
    # Update last seen
    if session_id in player_sessions:
        player_sessions[session_id]['last_seen'] = datetime.now(timezone.utc).isoformat()
    
    # Check if player is in an active game
    for game_id, game in active_games.items():
        if (game['player1']['session_id'] == session_id or 
            (game['player2'] and game['player2']['session_id'] == session_id)):
            return {
                'match_found': True,
                'game_id': game_id,
                'opponent_name': game['player2']['name'] if game['player1']['session_id'] == session_id else game['player1']['name']
            }
    
    # Still in queue
    if game_type in matchmaking_queue:
        queue = matchmaking_queue[game_type]
        in_queue = any(p['session_id'] == session_id for p in queue)
        if in_queue:
            position = next((i for i, p in enumerate(queue) if p['session_id'] == session_id), -1)
            return {
                'match_found': False,
                'in_queue': True,
                'queue_position': position + 1
            }
    
    return {
        'match_found': False,
        'in_queue': False
    }

@router.post("/http-multiplayer/leave-queue")
async def leave_matchmaking_queue(user_id: str) -> Dict[str, Any]:
    """Leave matchmaking queue"""
    session_id = get_session_id(user_id)
    
    # Remove from all queues
    for game_type in matchmaking_queue:
        matchmaking_queue[game_type] = [
            p for p in matchmaking_queue[game_type]
            if p['session_id'] != session_id
        ]
    
    return {'success': True}

@router.get("/http-multiplayer/game/{game_id}")
async def get_game_state(game_id: str, user_id: str) -> Dict[str, Any]:
    """
    Get current game state (client polls this every 1-2 seconds during game)
    """
    session_id = get_session_id(user_id)
    
    if game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = active_games[game_id]
    
    # Determine player role
    my_role = None
    if game['player1']['session_id'] == session_id:
        my_role = 'player1'
    elif game['player2'] and game['player2']['session_id'] == session_id:
        my_role = 'player2'
    else:
        raise HTTPException(status_code=403, detail="Not a player in this game")
    
    # Update last seen
    if session_id in player_sessions:
        player_sessions[session_id]['last_seen'] = datetime.now(timezone.utc).isoformat()
    
    return {
        'game_id': game['game_id'],
        'game_type': game['game_type'],
        'status': game['status'],
        'my_role': my_role,
        'is_my_turn': game['current_turn'] == my_role,
        'current_turn': game['current_turn'],
        'game_state': game['game_state'],
        'player1': game['player1'],
        'player2': game['player2'],
        'player3': game.get('player3'),
        'player4': game.get('player4'),
        'winner': game['winner'],
        'last_updated': game['last_updated']
    }

@router.post("/http-multiplayer/make-move")
async def make_move(request: MakeMoveRequest, user_id: str) -> Dict[str, Any]:
    """
    Make a move in the game
    """
    session_id = get_session_id(user_id)
    
    if request.game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = active_games[request.game_id]
    
    # Determine player role
    my_role = None
    if game['player1']['session_id'] == session_id:
        my_role = 'player1'
    elif game['player2'] and game['player2']['session_id'] == session_id:
        my_role = 'player2'
    elif game.get('player3') and game['player3']['session_id'] == session_id:
        my_role = 'player3'
    elif game.get('player4') and game['player4']['session_id'] == session_id:
        my_role = 'player4'
    else:
        raise HTTPException(status_code=403, detail="Not a player in this game")
    
    # Verify it's player's turn
    if game['current_turn'] != my_role:
        raise HTTPException(status_code=400, detail="Not your turn")

    # ─────────── Florida-Flow anti-cheat: Renegade Check ───────────
    # If this is a Spades trick-play move, validate that the played card
    # follows the lead suit when the player is holding one. Server is the
    # final authority — even if the client lies in `new_game_state.hands`,
    # we use the LAST authoritative state we have.
    if game['game_type'] == 'spades':
        renegade_err = _spades_renegade_check(
            prior_state=game.get('game_state', {}),
            next_state=request.new_game_state,
            player_role=my_role,
        )
        if renegade_err:
            raise HTTPException(status_code=400, detail=f"Renegade: {renegade_err}")

    # Update game state
    game['game_state'] = request.new_game_state
    game['last_updated'] = datetime.now(timezone.utc).isoformat()
    
    # Switch turn (4-player rotation for Spades)
    if game['game_type'] == 'spades':
        players = ['player1', 'player2', 'player3', 'player4']
        current_index = players.index(my_role)
        next_index = (current_index + 1) % 4
        game['current_turn'] = players[next_index]
    else:
        # 2-player toggle
        game['current_turn'] = 'player2' if my_role == 'player1' else 'player1'
    
    # Update last seen
    if session_id in player_sessions:
        player_sessions[session_id]['last_seen'] = datetime.now(timezone.utc).isoformat()
    
    return {
        'success': True,
        'game_state': game['game_state'],
        'current_turn': game['current_turn']
    }


@router.post("/http-multiplayer/place-bid")
async def place_bid(game_id: str, user_id: str, bid_value: int, is_nil: bool = False, is_blind: bool = False) -> Dict[str, Any]:
    """
    Place bid in Spades game (bidding phase)
    """
    session_id = get_session_id(user_id)
    
    if game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = active_games[game_id]
    
    if game['game_type'] != 'spades':
        raise HTTPException(status_code=400, detail="Bidding only available for Spades")
    
    if game['status'] != 'bidding':
        raise HTTPException(status_code=400, detail="Not in bidding phase")
    
    # Determine player role
    my_role = None
    for role in ['player1', 'player2', 'player3', 'player4']:
        if game.get(role) and game[role]['session_id'] == session_id:
            my_role = role
            break
    
    if not my_role:
        raise HTTPException(status_code=403, detail="Not a player in this game")
    
    # Store bid
    game['game_state']['bids'][my_role] = {
        'value': bid_value,
        'is_nil': is_nil,
        'is_blind': is_blind
    }
    
    # Check if all 4 players have bid
    if len(game['game_state']['bids']) == 4:
        # Calculate team bids
        # Team 1: Player1 + Player3
        team1_bid = (game['game_state']['bids']['player1']['value'] + 
                     game['game_state']['bids']['player3']['value'])
        # Team 2: Player2 + Player4
        team2_bid = (game['game_state']['bids']['player2']['value'] + 
                     game['game_state']['bids']['player4']['value'])
        
        game['game_state']['team1_bid'] = team1_bid
        game['game_state']['team2_bid'] = team2_bid
        
        # Check for Nil and Blind
        game['game_state']['team1_nil'] = (game['game_state']['bids']['player1']['is_nil'] or 
                                            game['game_state']['bids']['player3']['is_nil'])
        game['game_state']['team2_nil'] = (game['game_state']['bids']['player2']['is_nil'] or 
                                            game['game_state']['bids']['player4']['is_nil'])
        
        game['game_state']['team1_blind'] = (game['game_state']['bids']['player1']['is_blind'] or 
                                              game['game_state']['bids']['player3']['is_blind'])
        game['game_state']['team2_blind'] = (game['game_state']['bids']['player2']['is_blind'] or 
                                              game['game_state']['bids']['player4']['is_blind'])
        
        # Change phase to playing
        game['status'] = 'playing'
        game['game_state']['phase'] = 'playing'
    
    game['last_updated'] = datetime.now(timezone.utc).isoformat()
    
    return {
        'success': True,
        'bids_complete': len(game['game_state']['bids']) == 4,
        'phase': game['status']
    }

@router.post("/http-multiplayer/end-game")
async def end_game(game_id: str, user_id: str, winner: str) -> Dict[str, Any]:
    """End game and declare winner (idempotent — only first call sets status)."""
    session_id = get_session_id(user_id)

    if game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")

    game = active_games[game_id]

    # Verify player is in game (supports 2 and 4-player games)
    participant = False
    for role in ('player1', 'player2', 'player3', 'player4'):
        p = game.get(role)
        if p and p.get('session_id') == session_id:
            participant = True
            break
    if not participant:
        raise HTTPException(status_code=403, detail="Not a player in this game")

    # Idempotent — first call wins; later submissions ignored
    if game.get('status') != 'completed':
        game['status'] = 'completed'
        game['winner'] = winner
        game['last_updated'] = datetime.now(timezone.utc).isoformat()

        # Profit-share accrual — every player at this table earns +3 stakes
        # for completing a card-game hand (Spades / BidWhist / Hearts / etc).
        # Fire-and-forget — never blocks game settlement.
        try:
            from routes.profit_share import accrue_stake
            for role in ('player1', 'player2', 'player3', 'player4'):
                p = game.get(role)
                uid = (p or {}).get('user_id')
                if uid:
                    await accrue_stake(
                        uid, "card_game_played",
                        meta={"game_id": game_id, "game_type": game.get('game_type'), "winner": winner == role},
                    )
        except Exception:
            pass

    return {'success': True, 'winner': game.get('winner')}


@router.post("/http-multiplayer/claim-win")
async def claim_win(game_id: str, user_id: str) -> Dict[str, Any]:
    """Award $DSG to the declared winner exactly once per game.

    Idempotent: a win flag is set on the game record after the first claim,
    so double-submitting returns {mined: 0, already_claimed: true}.
    """
    if game_id not in active_games:
        raise HTTPException(status_code=404, detail="Game not found")

    game = active_games[game_id]
    if game.get('status') != 'completed' or not game.get('winner'):
        raise HTTPException(status_code=400, detail="Game not completed / no winner declared")

    # Verify user IS the winner (not just a participant) — supports 4-player games
    session_id = get_session_id(user_id)
    winner_role = game['winner']  # "player1" | "player2" | "player3" | "player4"
    winner_session = (game.get(winner_role) or {}).get('session_id')
    if winner_session != session_id:
        raise HTTPException(status_code=403, detail="Only the winner can claim")

    # Idempotency
    if game.get('vibez_claimed'):
        return {"mined": 0.0, "already_claimed": True, "winner": game.get('winner_user_id')}

    # Record mining event — record_event does the tier/multiplier math server-side
    try:
        from utils.mining_engine import record_event
        result = await record_event(
            user_id=user_id,
            event="game_won",
            game_type=game.get('game_type'),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mining failed: {e}")

    game['vibez_claimed'] = True
    game['winner_user_id'] = user_id
    game['claim_timestamp'] = datetime.now(timezone.utc).isoformat()

    return {
        "mined": result.get("mined", 0.0),
        "total": result.get("total", 0.0),
        "reason": result.get("reason"),
        "locked": result.get("locked", False),
        "game_type": game.get('game_type'),
    }

@router.get("/http-multiplayer/stats")
async def get_multiplayer_stats() -> Dict[str, Any]:
    """Get multiplayer statistics"""
    cleanup_expired_sessions()
    
    return {
        'active_games': len([g for g in active_games.values() if g['status'] == 'playing']),
        'total_games': len(active_games),
        'online_players': len(player_sessions),
        'matchmaking_queues': {
            game_type: len(queue) 
            for game_type, queue in matchmaking_queue.items()
        }
    }

@router.post("/http-multiplayer/heartbeat")
async def heartbeat(user_id: str) -> Dict[str, Any]:
    """Keep session alive (client calls this every 30 seconds)"""
    session_id = get_session_id(user_id)
    
    if session_id in player_sessions:
        player_sessions[session_id]['last_seen'] = datetime.now(timezone.utc).isoformat()
    
    return {'success': True, 'session_id': session_id}



# ==================== GAME INITIALIZATION HELPERS ====================

def initialize_game_state(game_type: str) -> Dict:
    """Initialize game-specific state for multiplayer games"""
    
    if game_type == 'tictactoe':
        return {'board': [None] * 144}  # 12x12 grid
    
    elif game_type == 'connect4':
        return {'board': [None] * (19 * 18)}  # 19x18 grid
    
    elif game_type == 'chess':
        return {
            'fen': 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves_history': []
        }
    
    elif game_type == 'trivia':
        # Generate 10 random trivia questions
        questions = generate_trivia_questions(10)
        return {
            'questions': questions,
            'current_question': questions[0] if questions else None,
            'question_index': 0,
            'player_scores': {'player1': 0, 'player2': 0},
            'player_answers': {'player1': [], 'player2': []}
        }
    
    elif game_type == 'uno':
        # Build UNO deck
        colors = ['R', 'G', 'B', 'Y']
        deck = []
        
        # Numbered cards
        for color in colors:
            deck.append(f"{color}0")
            for num in range(1, 10):
                deck.extend([f"{color}{num}", f"{color}{num}"])
        
        # Special cards
        for color in colors:
            deck.extend([f"{color}SKIP", f"{color}SKIP"])
            deck.extend([f"{color}REVERSE", f"{color}REVERSE"])
            deck.extend([f"{color}DRAW2", f"{color}DRAW2"])
        
        # Wild cards
        deck.extend(['WILD'] * 4)
        deck.extend(['WILDDRAW4'] * 4)
        
        secure_random.shuffle(deck)
        
        # Deal hands
        player1_hand = [deck.pop() for _ in range(7)]
        player2_hand = [deck.pop() for _ in range(7)]
        
        # Get starting card
        top_card = deck.pop()
        while top_card.startswith('WILD'):
            deck.insert(0, top_card)
            top_card = deck.pop()
        
        current_color = top_card[0] if top_card[0] in colors else 'R'
        
        return {
            'hands': {
                'player1': player1_hand,
                'player2': player2_hand,
                'player3': [deck.pop() for _ in range(7)],
                'player4': [deck.pop() for _ in range(7)]
            },
            'deck': deck,
            'top_card': top_card,
            'discard_pile': [top_card],
            'wild_color': None,
            'current_color': current_color,
            'direction': 1,  # 1=clockwise, -1=counterclockwise
            'draw_stack': 0,
            'pending_draw_player': None,
            'last_card_type': None,
            'uno_called': {}
        }
    
    elif game_type == 'poker':
        # Texas Hold'em setup
        suits = ['H', 'D', 'C', 'S']
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        
        return {
            'player1_hand': [deck.pop(), deck.pop()],
            'player2_hand': [deck.pop(), deck.pop()],
            'community_cards': [],
            'deck': deck,
            'pot': 20,
            'player1_chips': 990,
            'player2_chips': 990,
            'current_bet': 10,
            'player1_bet': 10,
            'player2_bet': 10,
            'round': 'preflop'  # preflop, flop, turn, river
        }
    
    elif game_type == 'rummy':
        # Rummy setup
        suits = ['H', 'D', 'C', 'S']
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks] * 2  # Two decks
        secure_random.shuffle(deck)
        
        return {
            'player1_hand': [deck.pop() for _ in range(13)],
            'player2_hand': [deck.pop() for _ in range(13)],
            'deck': deck,
            'discard_pile': [deck.pop()],
            'player1_melds': [],
            'player2_melds': []
        }
    
    elif game_type == 'hearts':
        # Hearts setup
        suits = ['H', 'D', 'C', 'S']
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        
        return {
            'player1_hand': [deck.pop() for _ in range(13)],
            'player2_hand': [deck.pop() for _ in range(13)],
            'current_trick': [],
            'player1_score': 0,
            'player2_score': 0,
            'trick_count': 0
        }
    
    elif game_type == 'truthordare':
        # Truth or Dare setup
        truths = [
            "What's your biggest fear?",
            "Have you ever lied to a friend?",
            "What's your most embarrassing moment?",
            "Who was your first crush?",
            "What's a secret you've never told anyone?"
        ]
        
        dares = [
            "Do 10 pushups right now!",
            "Sing your favorite song out loud",
            "Dance for 30 seconds",
            "Tell a joke",
            "Make a funny face and hold it for 10 seconds"
        ]
        
        return {
            'truths': truths,
            'dares': dares,
            'current_challenge': None,
            'round_number': 1,
            'player1_completed': 0,
            'player2_completed': 0,
            'player1_choice': None,
            'player2_choice': None
        }
    
    elif game_type == 'checkers':
        # Checkers 8x8 board setup (2D array with tower stacking)
        board = [[None for _ in range(8)] for _ in range(8)]
        
        # Place red pieces (player1) on top (rows 0-2)
        for row in range(3):
            for col in range(8):
                if (row + col) % 2 == 1:
                    board[row][col] = {
                        'owner': 'player1',
                        'color': 'red',
                        'isKing': False,
                        'stack': ['red']  # Tower stacking
                    }
        
        # Place black pieces (player2) on bottom (rows 5-7)
        for row in range(5, 8):
            for col in range(8):
                if (row + col) % 2 == 1:
                    board[row][col] = {
                        'owner': 'player2',
                        'color': 'black',
                        'isKing': False,
                        'stack': ['black']  # Tower stacking
                    }
        
        return {
            'board': board,
            'player1_pieces': 12,
            'player2_pieces': 12,
            'last_move': None,
            'forced_jumps': []
        }
    
    elif game_type == 'blackjack':
        # Blackjack setup
        suits = ['H', 'D', 'C', 'S']
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        
        return {
            'player1_hand': [deck.pop(), deck.pop()],
            'player2_hand': [deck.pop(), deck.pop()],
            'dealer_hand': [deck.pop(), deck.pop()],
            'deck': deck,
            'player1_chips': 1000,
            'player2_chips': 1000,
            'player1_bet': 10,
            'player2_bet': 10,
            'show_dealer_card': False
        }
    
    elif game_type == 'spades':
        # Spades setup (4-player partnership game)
        suits = ['H', 'D', 'C', 'S']
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        
        return {
            # Player hands (13 cards each for 4 players)
            'hands': {
                'player1': [deck.pop() for _ in range(13)],
                'player2': [deck.pop() for _ in range(13)],
                'player3': [deck.pop() for _ in range(13)],
                'player4': [deck.pop() for _ in range(13)]
            },
            # Bidding phase
            'phase': 'bidding',  # bidding -> playing -> scoring
            'bids': {},  # Will store each player's bid
            'team1_bid': 0,  # Player1 + Player3 total bid
            'team2_bid': 0,  # Player2 + Player4 total bid
            'team1_nil': False,
            'team2_nil': False,
            'team1_blind': False,
            'team2_blind': False,
            # Game state
            'current_trick': [],
            'spades_broken': False,
            # Team scores
            'team1_score': 0,  # Player1 + Player3 partnership
            'team2_score': 0,  # Player2 + Player4 partnership
            'team1_tricks': 0,
            'team2_tricks': 0,
            'team1_bags': 0,
            'team2_bags': 0,
            # Round tracking
            'rounds_completed': 0
        }
    
    elif game_type == 'gofish':
        # Go Fish setup
        suits = ['H', 'D', 'C', 'S']
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        
        return {
            'player1_hand': [deck.pop() for _ in range(7)],
            'player2_hand': [deck.pop() for _ in range(7)],
            'deck': deck,
            'player1_books': [],
            'player2_books': []
        }

    elif game_type == 'war':
        # War — simplest 2-player card game. 52 cards split 50/50. Each
        # player flips their top card; higher rank wins both. Ties trigger
        # "war" (burn 3, flip 1). Player with all cards wins.
        suits = ['H', 'D', 'C', 'S']
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        half = len(deck) // 2
        return {
            'player1_pile': deck[:half],
            'player2_pile': deck[half:],
            'player1_played': None,
            'player2_played': None,
            'war_pile': [],          # cards escrow'd during a war
            'last_round_winner': None,
            'in_war': False,
            'round_number': 0,
        }

    elif game_type == 'crazy_eights':
        # Crazy Eights — proto-UNO. Match suit OR rank. 8s are wild.
        suits = ['H', 'D', 'C', 'S']
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)

        p1 = [deck.pop() for _ in range(7)]
        p2 = [deck.pop() for _ in range(7)]
        # First discard can't be an 8 — keep drawing until it's not
        top = deck.pop()
        while top.startswith('8'):
            deck.insert(0, top)
            top = deck.pop()
        return {
            'player1_hand': p1,
            'player2_hand': p2,
            'deck': deck,
            'discard_pile': [top],
            'top_card': top,
            'active_suit': top[-1],   # last char is suit; 8s override with 'wild_suit'
            'wild_suit': None,        # set when a player plays an 8
        }

    elif game_type == 'gin_rummy':
        # Gin Rummy — 2 players, 10 cards each. Form melds (runs/sets),
        # knock to end the round when deadwood <= 10.
        suits = ['H', 'D', 'C', 'S']
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        return {
            'player1_hand': [deck.pop() for _ in range(10)],
            'player2_hand': [deck.pop() for _ in range(10)],
            'deck': deck,
            'discard_pile': [deck.pop()],
            'player1_score': 0,
            'player2_score': 0,
            'phase': 'draw',          # draw -> discard -> next turn
            'last_drawn': None,       # for undo of pickup-discard
            'knocked_by': None,       # player who knocked
        }
    
    elif game_type == 'ludo':
        # Ludo setup - 4 tokens per player starting at home (position 0)
        return {
            'positions': {
                'red': [0, 0, 0, 0],    # player1 tokens
                'blue': [0, 0, 0, 0]     # player2 tokens
            },
            'last_roll': None,
            'dice_value': None
        }
    
    elif game_type == 'dominoes':
        # Dominoes setup - generate domino set (0-0 through 6-6)
        dominoes = []
        for i in range(7):
            for j in range(i, 7):
                dominoes.append({'top': i, 'bottom': j})
        
        secure_random.shuffle(dominoes)
        
        # Deal 7 dominoes to each player
        return {
            'hands': {
                'player1': [dominoes.pop() for _ in range(7)],
                'player2': [dominoes.pop() for _ in range(7)]
            },
            'boneyard': dominoes,
            'played': [],
            'last_played': None
        }
    
    elif game_type == 'mancala':
        # Mancala setup - 6 pits per side, 4 stones each, plus 2 stores
        return {
            'pits': {
                'player1': [4, 4, 4, 4, 4, 4],  # Bottom row
                'player2': [4, 4, 4, 4, 4, 4]   # Top row
            },
            'stores': {
                'player1': 0,  # Right store
                'player2': 0   # Left store
            },
            'last_move': None
        }
    
    elif game_type == 'backgammon':
        # Backgammon setup - initial checker positions
        # Points numbered 1-24, negative for player2
        return {
            'board': {
                1: {'player': 'player2', 'count': 2},
                6: {'player': 'player1', 'count': 5},
                8: {'player': 'player1', 'count': 3},
                12: {'player': 'player2', 'count': 5},
                13: {'player': 'player1', 'count': 5},
                17: {'player': 'player2', 'count': 3},
                19: {'player': 'player2', 'count': 5},
                24: {'player': 'player1', 'count': 2}
            },
            'bar': {'player1': 0, 'player2': 0},
            'off': {'player1': 0, 'player2': 0},
            'dice': [0, 0],
            'rolled': False
        }
    
    elif game_type == 'chinesecheckers':
        # Chinese Checkers setup - simplified 2-player triangle positions
        # Using coordinate system for star-shaped board
        return {
            'positions': {
                'player1': [
                    {'x': 6, 'y': 0}, {'x': 5, 'y': 1}, {'x': 7, 'y': 1},
                    {'x': 4, 'y': 2}, {'x': 6, 'y': 2}, {'x': 8, 'y': 2},
                    {'x': 3, 'y': 3}, {'x': 5, 'y': 3}, {'x': 7, 'y': 3}, {'x': 9, 'y': 3}
                ],
                'player2': [
                    {'x': 6, 'y': 16}, {'x': 5, 'y': 15}, {'x': 7, 'y': 15},
                    {'x': 4, 'y': 14}, {'x': 6, 'y': 14}, {'x': 8, 'y': 14},
                    {'x': 3, 'y': 13}, {'x': 5, 'y': 13}, {'x': 7, 'y': 13}, {'x': 9, 'y': 13}
                ]
            },
            'selected_piece': None,
            'last_move': None
        }
    
    elif game_type == 'parcheesi':
        # Parcheesi setup - similar to Ludo but with different rules
        return {
            'positions': {
                'player1': [-1, -1, -1, -1],  # -1 means in home base
                'player2': [-1, -1, -1, -1]
            },
            'dice': [0, 0],
            'rolled': False,
            'blockades': [],
            'safe_spaces': [5, 12, 17, 22, 28, 33, 39, 45, 50, 55, 62, 67]
        }
    
    elif game_type == 'mahjong':
        # Mahjong setup - simplified 2-player version
        suits = ['bamboo', 'character', 'dot']
        tiles = []
        
        # Generate tiles (1-9 for each suit, 4 of each)
        for suit in suits:
            for value in range(1, 10):
                for _ in range(4):
                    tiles.append({'suit': suit, 'value': value})
        
        # Honor tiles
        for _ in range(4):
            tiles.extend([
                {'suit': 'wind', 'value': 'E'},
                {'suit': 'wind', 'value': 'S'},
                {'suit': 'wind', 'value': 'W'},
                {'suit': 'wind', 'value': 'N'},
                {'suit': 'dragon', 'value': 'red'},
                {'suit': 'dragon', 'value': 'green'},
                {'suit': 'dragon', 'value': 'white'}
            ])
        
        secure_random.shuffle(tiles)
        
        return {
            'hands': {
                'player1': [tiles.pop() for _ in range(13)],
                'player2': [tiles.pop() for _ in range(13)]
            },
            'wall': tiles,
            'discard_pile': []
        }
    
    elif game_type == 'carrom':
        # Carrom setup - board with pieces
        return {
            'pieces': [
                # White pieces (player1)
                {'color': 'white', 'position': {'x': 40, 'y': 40}},
                {'color': 'white', 'position': {'x': 45, 'y': 45}},
                {'color': 'white', 'position': {'x': 50, 'y': 50}},
                {'color': 'white', 'position': {'x': 55, 'y': 45}},
                {'color': 'white', 'position': {'x': 60, 'y': 40}},
                # Black pieces (player2)
                {'color': 'black', 'position': {'x': 40, 'y': 60}},
                {'color': 'black', 'position': {'x': 45, 'y': 55}},
                {'color': 'black', 'position': {'x': 50, 'y': 50}},
                {'color': 'black', 'position': {'x': 55, 'y': 55}},
                {'color': 'black', 'position': {'x': 60, 'y': 60}},
                # Red queen
                {'color': 'red', 'position': {'x': 50, 'y': 50}}
            ],
            'scores': {'player1': 0, 'player2': 0},
            'striker_position': {'x': 50, 'y': 10}
        }
    
    elif game_type == 'shogi':
        # Shogi (Japanese Chess) setup - 9x9 board
        board = [None] * 81
        
        # Player 1 pieces (bottom)
        board[72] = {'type': 'lance', 'player': 'player1', 'promoted': False}
        board[73] = {'type': 'knight', 'player': 'player1', 'promoted': False}
        board[74] = {'type': 'silver', 'player': 'player1', 'promoted': False}
        board[75] = {'type': 'gold', 'player': 'player1', 'promoted': False}
        board[76] = {'type': 'king', 'player': 'player1', 'promoted': False}
        board[77] = {'type': 'gold', 'player': 'player1', 'promoted': False}
        board[78] = {'type': 'silver', 'player': 'player1', 'promoted': False}
        board[79] = {'type': 'knight', 'player': 'player1', 'promoted': False}
        board[80] = {'type': 'lance', 'player': 'player1', 'promoted': False}
        
        # Pawns for player1
        for i in range(63, 72):
            board[i] = {'type': 'pawn', 'player': 'player1', 'promoted': False}
        
        # Player 2 pieces (top)
        board[0] = {'type': 'lance', 'player': 'player2', 'promoted': False}
        board[1] = {'type': 'knight', 'player': 'player2', 'promoted': False}
        board[2] = {'type': 'silver', 'player': 'player2', 'promoted': False}
        board[3] = {'type': 'gold', 'player': 'player2', 'promoted': False}
        board[4] = {'type': 'king', 'player': 'player2', 'promoted': False}
        board[5] = {'type': 'gold', 'player': 'player2', 'promoted': False}
        board[6] = {'type': 'silver', 'player': 'player2', 'promoted': False}
        board[7] = {'type': 'knight', 'player': 'player2', 'promoted': False}
        board[8] = {'type': 'lance', 'player': 'player2', 'promoted': False}
        
        # Pawns for player2
        for i in range(9, 18):
            board[i] = {'type': 'pawn', 'player': 'player2', 'promoted': False}
        
        return {
            'board': board,
            'captures': {'player1': [], 'player2': []}
        }
    
    elif game_type == 'xiangqi':
        # Xiangqi (Chinese Chess) setup - 9x10 board
        board = [None] * 90
        
        # Player 1 (Red) pieces - bottom
        board[81] = {'type': 'chariot', 'player': 'player1'}
        board[82] = {'type': 'horse', 'player': 'player1'}
        board[83] = {'type': 'elephant', 'player': 'player1'}
        board[84] = {'type': 'advisor', 'player': 'player1'}
        board[85] = {'type': 'general', 'player': 'player1'}
        board[86] = {'type': 'advisor', 'player': 'player1'}
        board[87] = {'type': 'elephant', 'player': 'player1'}
        board[88] = {'type': 'horse', 'player': 'player1'}
        board[89] = {'type': 'chariot', 'player': 'player1'}
        
        # Soldiers (pawns) for player1
        for col in [0, 2, 4, 6, 8]:
            board[54 + col] = {'type': 'soldier', 'player': 'player1'}
        
        # Player 2 (Black) pieces - top
        board[0] = {'type': 'chariot', 'player': 'player2'}
        board[1] = {'type': 'horse', 'player': 'player2'}
        board[2] = {'type': 'elephant', 'player': 'player2'}
        board[3] = {'type': 'advisor', 'player': 'player2'}
        board[4] = {'type': 'general', 'player': 'player2'}
        board[5] = {'type': 'advisor', 'player': 'player2'}
        board[6] = {'type': 'elephant', 'player': 'player2'}
        board[7] = {'type': 'horse', 'player': 'player2'}
        board[8] = {'type': 'chariot', 'player': 'player2'}
        
        # Soldiers (pawns) for player2
        for col in [0, 2, 4, 6, 8]:
            board[27 + col] = {'type': 'soldier', 'player': 'player2'}
        
        return {
            'board': board,
            'move_history': []
        }
    
    else:
        # Default empty state
        return {'board': []}


def generate_trivia_questions(count: int) -> List[Dict]:
    """Generate random trivia questions"""
    # Hardcoded trivia database (in production, use external API or database)
    trivia_bank = [
        {
            'question': 'What is the capital of France?',
            'correct_answer': 'Paris',
            'incorrect_answers': ['London', 'Berlin', 'Madrid']
        },
        {
            'question': 'Which planet is known as the Red Planet?',
            'correct_answer': 'Mars',
            'incorrect_answers': ['Venus', 'Jupiter', 'Saturn']
        },
        {
            'question': 'What == 2 + 2?',
            'correct_answer': '4',
            'incorrect_answers': ['3', '5', '22']
        },
        {
            'question': 'Who painted the Mona Lisa?',
            'correct_answer': 'Leonardo da Vinci',
            'incorrect_answers': ['Pablo Picasso', 'Vincent van Gogh', 'Michelangelo']
        },
        {
            'question': 'What is the largest ocean on Earth?',
            'correct_answer': 'Pacific Ocean',
            'incorrect_answers': ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean']
        },
        {
            'question': 'How many continents are there?',
            'correct_answer': '7',
            'incorrect_answers': ['5', '6', '8']
        },
        {
            'question': 'What year did World War II end?',
            'correct_answer': '1945',
            'incorrect_answers': ['1944', '1946', '1943']
        },
        {
            'question': 'What is the smallest prime number?',
            'correct_answer': '2',
            'incorrect_answers': ['1', '3', '0']
        },
        {
            'question': 'Which element has the chemical symbol "O"?',
            'correct_answer': 'Oxygen',
            'incorrect_answers': ['Gold', 'Silver', 'Osmium']
        },
        {
            'question': 'What is the speed of light?',
            'correct_answer': '299,792,458 m/s',
            'incorrect_answers': ['300,000,000 m/s', '150,000,000 m/s', '500,000,000 m/s']
        },
        {
            'question': 'Who wrote "Romeo and Juliet"?',
            'correct_answer': 'William Shakespeare',
            'incorrect_answers': ['Charles Dickens', 'Jane Austen', 'Mark Twain']
        },
        {
            'question': 'What is the capital of Japan?',
            'correct_answer': 'Tokyo',
            'incorrect_answers': ['Kyoto', 'Osaka', 'Seoul']
        },
        {
            'question': 'How many sides does a hexagon have?',
            'correct_answer': '6',
            'incorrect_answers': ['5', '7', '8']
        },
        {
            'question': 'What is the largest mammal?',
            'correct_answer': 'Blue Whale',
            'incorrect_answers': ['African Elephant', 'Giraffe', 'Great White Shark']
        },
        {
            'question': 'Which programming language is known for web development?',
            'correct_answer': 'JavaScript',
            'incorrect_answers': ['Python', 'C++', 'Java']
        }
    ]
    
    # Shuffle and return requested count
    secure_random.shuffle(trivia_bank)
    return trivia_bank[:min(count, len(trivia_bank))]
