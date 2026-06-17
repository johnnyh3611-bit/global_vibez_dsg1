from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from utils.game_ai import GameAI
from datetime import datetime, timezone
import uuid
import asyncio

router = APIRouter(prefix="/practice", tags=["practice"])
import httpx
import secrets
secure_random = secrets.SystemRandom()
from dotenv import load_dotenv
import os
from services.ai_engine import LlmChat, UserMessage

load_dotenv()


# ==================== MODELS ====================

class StartPracticeGame(BaseModel):
    game_type: str
    difficulty: str = "medium"  # easy, medium, hard

class PracticeMove(BaseModel):
    move_data: Dict

# ==================== ENDPOINTS ====================

@router.post("/start")
async def start_practice_game(game_data: StartPracticeGame, request: Request) -> Dict[str, Any]:
    """Start a new practice game with AI opponent"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Validate game type
    valid_games = [
        "tictactoe", "connect4", "checkers", "reversi", "chess",
        "ludo", "backgammon", "blackjack", "uno", "go_fish",
        "crazy_eights", "hearts", "spades", "rummy", "poker",
        "trivia", "truthordare"
    ]
    
    if game_data.game_type not in valid_games:
        raise HTTPException(status_code=400, detail=f"Game type {game_data.game_type} not supported for practice mode")
    
    # Initialize game state based on type
    game_state = initialize_practice_game(game_data.game_type)
    
    # Create practice game
    game_id = f"practice_{uuid.uuid4().hex[:12]}"
    practice_game = {
        "game_id": game_id,
        "user_id": current_user.user_id,
        "game_type": game_data.game_type,
        "difficulty": game_data.difficulty,
        "game_state": game_state,
        "status": "in_progress",
        "current_turn": "player",  # player or ai
        "created_at": datetime.now(timezone.utc).isoformat(),
        "moves_history": []
    }
    
    await db.practice_games.insert_one(practice_game)
    
    return {
        "game_id": game_id,
        "game_type": game_data.game_type,
        "difficulty": game_data.difficulty,
        "game_state": game_state,
        "current_turn": "player",
        "message": f"Practice game started! You're playing against {game_data.difficulty} AI"
    }

@router.get("/game/{game_id}")
async def get_practice_game(game_id: str, request: Request) -> Dict[str, Any]:
    """Get current practice game state"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.practice_games.find_one(
        {"game_id": game_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not game:
        raise HTTPException(status_code=404, detail="Practice game not found")
    
    return game

@router.post("/game/{game_id}/move")
async def make_practice_move(game_id: str, move: PracticeMove, request: Request) -> Dict[str, Any]:
    """Make a move in practice game and get AI response"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.practice_games.find_one(
        {"game_id": game_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not game:
        raise HTTPException(status_code=404, detail="Practice game not found")
    
    if game["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Game is not in progress")
    
    if game["current_turn"] != "player":
        raise HTTPException(status_code=400, detail="Not your turn")
    
    # Apply player move
    game_state = game["game_state"]
    game_state = apply_move(game["game_type"], game_state, move.move_data, "player")
    
    # Check if game ended after player move
    game_status = check_game_status(game["game_type"], game_state)
    
    if game_status.get("ended", False):
        await db.practice_games.update_one(
            {"game_id": game_id},
            {"$set": {
                "game_state": game_state,
                "status": "completed",
                "winner": game_status.get("winner"),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {
            "game_state": game_state,
            "status": "completed",
            "winner": game_status.get("winner"),
            "message": game_status.get("message", "Game over")
        }
    
    # AI's turn - simulate thinking delay
    await asyncio.sleep(0.5)  # AI "thinking" time
    
    # Get AI move
    ai = GameAI(difficulty=game["difficulty"])
    try:
        ai_move = ai.get_move(game_state, game["game_type"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")
    
    # Apply AI move
    game_state = apply_move(game["game_type"], game_state, ai_move, "ai")
    
    # Check if game ended after AI move
    game_status = check_game_status(game["game_type"], game_state)
    
    update_data = {
        "game_state": game_state,
        "current_turn": "player" if not game_status.get("ended", False) else "none",
        "$push": {
            "moves_history": {
                "player_move": move.move_data,
                "ai_move": ai_move,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    }
    
    if game_status.get("ended", False):
        update_data["status"] = "completed"
        update_data["winner"] = game_status.get("winner")
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.practice_games.update_one(
        {"game_id": game_id},
        {"$set": update_data, "$push": update_data.pop("$push")}
    )
    
    return {
        "game_state": game_state,
        "ai_move": ai_move,
        "status": "completed" if game_status.get("ended", False) else "in_progress",
        "winner": game_status.get("winner") if game_status.get("ended", False) else None,
        "current_turn": "player" if not game_status.get("ended", False) else "none",
        "message": game_status.get("message", "Your turn") if game_status.get("ended", False) else "Your turn"
    }

@router.get("/stats")
async def get_practice_stats(request: Request) -> Dict[str, Any]:
    """Get user's practice game statistics"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    games = await db.practice_games.find(
        {"user_id": current_user.user_id, "status": "completed"},
        {"_id": 0}
    ).to_list(1000)
    
    if not games:
        return {
            "total_games": 0,
            "wins": 0,
            "losses": 0,
            "win_rate": 0,
            "games_by_type": {},
            "games_by_difficulty": {}
        }
    
    wins = sum(1 for g in games if g.get("winner") == "player")
    losses = sum(1 for g in games if g.get("winner") == "ai")
    
    games_by_type = {}
    for game in games:
        game_type = game["game_type"]
        games_by_type[game_type] = games_by_type.get(game_type, 0) + 1
    
    games_by_difficulty = {}
    for game in games:
        diff = game["difficulty"]
        games_by_difficulty[diff] = games_by_difficulty.get(diff, 0) + 1
    
    return {
        "total_games": len(games),
        "wins": wins,
        "losses": losses,
        "draws": len(games) - wins - losses,
        "win_rate": round((wins / len(games)) * 100, 1) if games else 0,
        "games_by_type": games_by_type,
        "games_by_difficulty": games_by_difficulty
    }

# ==================== HELPER FUNCTIONS ====================

def initialize_practice_game(game_type: str) -> Dict:
    """Initialize game state for practice mode"""
    if game_type == "tictactoe":
        return {"board": [["", "", ""], ["", "", ""], ["", "", ""]]}
    elif game_type == "connect4":
        return {
            "board": [["" for _ in range(7)] for _ in range(6)],
            "player_color": "red",
            "ai_color": "yellow",
            "player_score": 0,
            "ai_score": 0
        }
    elif game_type == "chess":
        # Initialize with FEN notation (standard starting position)
        return {
            "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "moves_history": []
        }
    elif game_type == "checkers":
        # Initialize checkers board
        board = [[None for _ in range(8)] for _ in range(8)]
        for row in range(3):
            for col in range(8):
                if (row + col) % 2 == 1:
                    board[row][col] = {"player": "ai", "king": False}
        for row in range(5, 8):
            for col in range(8):
                if (row + col) % 2 == 1:
                    board[row][col] = {"player": "player", "king": False}
        return {"board": board}
    elif game_type == "reversi":
        # Initialize reversi/othello board
        board = [["" for _ in range(8)] for _ in range(8)]
        board[3][3] = "ai"
        board[3][4] = "player"
        board[4][3] = "player"
        board[4][4] = "ai"
        return {"board": board}
    elif game_type == "blackjack":
        suits = ['H', 'D', 'C', 'S']
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        player_hand = [deck.pop(), deck.pop()]
        dealer_hand = [deck.pop(), deck.pop()]
        # Calculate initial scores
        player_score = calculate_blackjack_value(player_hand)
        dealer_score = calculate_blackjack_value(dealer_hand)
        return {
            "player_hand": player_hand,
            "dealer_hand": dealer_hand,
            "deck": deck,
            "player_score": player_score,
            "dealer_score": dealer_score,
            "player_balance": 1000,
            "current_bet": 10
        }
    elif game_type == "uno":
        colors = ['R', 'G', 'B', 'Y']
        
        # Build full UNO deck
        deck = []
        
        # Numbered cards: 0 (1 per color), 1-9 (2 per color)
        for color in colors:
            deck.append(f"{color}0")  # One 0 per color
            for num in range(1, 10):
                deck.extend([f"{color}{num}", f"{color}{num}"])  # Two of each 1-9
        
        # Special cards: Skip, Reverse, Draw Two (2 per color)
        for color in colors:
            deck.extend([f"{color}SKIP", f"{color}SKIP"])
            deck.extend([f"{color}REVERSE", f"{color}REVERSE"])
            deck.extend([f"{color}DRAW2", f"{color}DRAW2"])
        
        # Wild cards (4 each)
        deck.extend(['WILD'] * 4)
        deck.extend(['WILDDRAW4'] * 4)
        
        secure_random.shuffle(deck)
        
        # Deal hands
        player_hand = [deck.pop() for _ in range(7)]
        ai_hand = [deck.pop() for _ in range(7)]
        
        # Get starting top card (can't be Wild or Wild Draw Four)
        top_card = deck.pop()
        while top_card.startswith('WILD'):
            deck.insert(0, top_card)
            top_card = deck.pop()
        
        # Determine starting color
        current_color = top_card[0] if top_card[0] in colors else 'R'
        
        return {
            "player_hand": player_hand,
            "ai_hand": ai_hand,  # Store full AI hand for proper gameplay
            "ai_hand_count": len(ai_hand),
            "deck": deck,
            "deck_count": len(deck),
            "top_card": top_card,
            "current_color": current_color,
            "direction": 1,  # 1 = clockwise, -1 = counterclockwise
            "draw_stack": 0,  # Accumulated draw penalties
            "player_score": 0,
            "ai_score": 0
        }
    elif game_type == "go_fish":
        suits = ['H', 'D', 'C', 'S']
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        player_hand = [deck.pop() for _ in range(7)]
        ai_hand_count = 7
        return {
            "player_hand": player_hand,
            "ai_hand_count": ai_hand_count,
            "deck_count": len(deck)
        }
    elif game_type == "crazy_eights":
        suits = ['H', 'D', 'C', 'S']
        ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        player_hand = [deck.pop() for _ in range(8)]
        top_card = deck.pop()
        return {
            "player_hand": player_hand,
            "ai_hand_count": 8,
            "deck_count": len(deck),
            "top_card": top_card
        }
    elif game_type == "hearts":
        suits = ['H', 'D', 'C', 'S']
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        player_hand = [deck.pop() for _ in range(13)]
        ai_hand = [deck.pop() for _ in range(13)]
        return {
            "player_hand": player_hand,
            "ai_hand": ai_hand,
            "current_trick": [],
            "player_score": 0,
            "ai_score": 0
        }
    elif game_type == "poker":
        suits = ['H', 'D', 'C', 'S']
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
        secure_random.shuffle(deck)
        player_hand = [deck.pop(), deck.pop()]
        return {
            "player_hand": player_hand,
            "community_cards": [],
            "pot": 100,
            "player_chips": 900,
            "ai_chips": 900,
            "current_bet": 10
        }
    elif game_type == "spades":
        # Create full deck for spades
        suits = ['spades', 'hearts', 'diamonds', 'clubs']
        ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
        rank_values = {'2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, 
                      '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14}
        
        deck = []
        for suit in suits:
            for rank in ranks:
                deck.append({'suit': suit, 'rank': rank, 'value': rank_values[rank]})
        secure_random.shuffle(deck)
        
        # Deal 13 cards to player (practice mode - 4 players simulated)
        player_hand = [deck.pop() for _ in range(13)]
        partner_hand = [deck.pop() for _ in range(13)]
        opp1_hand = [deck.pop() for _ in range(13)]
        opp2_hand = [deck.pop() for _ in range(13)]
        
        # Sort hands by suit and rank
        for hand in [player_hand, partner_hand, opp1_hand, opp2_hand]:
            hand.sort(key=lambda c: (suits.index(c['suit']), c['value']))
        
        return {
            "player_hand": player_hand,
            "partner_hand": partner_hand,
            "opp1_hand": opp1_hand,
            "opp2_hand": opp2_hand,
            "current_trick": [],
            "phase": "bidding",
            "team_scores": {"team1": 0, "team2": 0},
            "team_bids": {"team1": 0, "team2": 0},
            "bags": {"team1": 0, "team2": 0},
            "tricks_won": {"player": 0, "partner": 0, "opp1": 0, "opp2": 0},
            "spades_broken": False,
            "bids": {"player": None, "partner": None, "opp1": None, "opp2": None}
        }
    else:
        return {}

def calculate_blackjack_value(hand):
    """Calculate the value of a blackjack hand"""
    value = 0
    aces = 0
    for card in hand:
        rank = card[:-1]  # Remove suit
        if rank in ['J', 'Q', 'K']:
            value += 10
        elif rank == 'A':
            aces += 1
            value += 11
        else:
            value += int(rank)
    
    # Adjust for aces
    while value > 21 and aces > 0:
        value -= 10
        aces -= 1
    
    return value

def apply_move(game_type: str, game_state: Dict, move: Dict, player: str) -> Dict:
    """Apply move to game state"""
    import secrets
    
    if game_type == "tictactoe":
        row, col = move.get("row"), move.get("col")
        if row is not None and col is not None:
            game_state["board"][row][col] = "X" if player == "player" else "O"
    
    elif game_type == "connect4":
        # Accept both 'column' and 'col' parameter names - handle 0 correctly
        col = move.get("column") if move.get("column") is not None else move.get("col")
        if col is not None:
            for row in range(5, -1, -1):
                if game_state["board"][row][col] == "":
                    game_state["board"][row][col] = "red" if player == "player" else "yellow"
                    break
    
    elif game_type == "chess":
        # Handle chess moves using FEN notation
        fen = move.get("fen")
        if fen:
            game_state["fen"] = fen
            if "moves_history" not in game_state:
                game_state["moves_history"] = []
            game_state["moves_history"].append({
                "from": move.get("from"),
                "to": move.get("to"),
                "fen": fen
            })
    
    elif game_type == "checkers":
        # Handle checkers moves - format: {from: [row, col], to: [row, col]}
        from_pos = move.get("from")
        to_pos = move.get("to")
        if from_pos and to_pos:
            from_row, from_col = from_pos
            to_row, to_col = to_pos
            piece = game_state["board"][from_row][from_col]
            game_state["board"][from_row][from_col] = None
            game_state["board"][to_row][to_col] = piece
            
            # Check for capture (jump)
            if abs(from_row - to_row) == 2:
                mid_row = (from_row + to_row) // 2
                mid_col = (from_col + to_col) // 2
                game_state["board"][mid_row][mid_col] = None
            
            # King promotion
            if piece and piece.get("player") == "player" and to_row == 0:
                piece["king"] = True
            elif piece and piece.get("player") == "ai" and to_row == 7:
                piece["king"] = True
    
    elif game_type == "reversi":
        # Handle reversi moves - format: {row, col}
        row, col = move.get("row"), move.get("col")
        if row is not None and col is not None:
            board = game_state["board"]
            board[row][col] = player
            
            # Flip opponent pieces
            opponent = "ai" if player == "player" else "player"
            directions = [(-1,-1), (-1,0), (-1,1), (0,-1), (0,1), (1,-1), (1,0), (1,1)]
            
            for dr, dc in directions:
                pieces_to_flip = []
                r, c = row + dr, col + dc
                
                while 0 <= r < 8 and 0 <= c < 8 and board[r][c] == opponent:
                    pieces_to_flip.append((r, c))
                    r += dr
                    c += dc
                
                if pieces_to_flip and 0 <= r < 8 and 0 <= c < 8 and board[r][c] == player:
                    for flip_r, flip_c in pieces_to_flip:
                        board[flip_r][flip_c] = player
    
    elif game_type == "blackjack":
        action = move.get("action")
        if action == "hit" and player == "player":
            deck = game_state.get("deck", [])
            if deck:
                game_state["player_hand"].append(deck.pop())
                # Update player score after hit
                game_state["player_score"] = calculate_blackjack_value(game_state["player_hand"])
                game_state["dealer_score"] = calculate_blackjack_value(game_state["dealer_hand"])
        elif action == "stand" and player == "player":
            # Player stands - dealer plays until 17 or higher
            dealer_hand = game_state.get("dealer_hand", [])
            deck = game_state.get("deck", [])
            dealer_value = calculate_blackjack_value(dealer_hand)
            
            # Dealer hits on 16 or less
            while dealer_value < 17 and deck:
                dealer_hand.append(deck.pop())
                dealer_value = calculate_blackjack_value(dealer_hand)
            
            game_state["dealer_hand"] = dealer_hand
            # Update scores after stand
            game_state["player_score"] = calculate_blackjack_value(game_state["player_hand"])
            game_state["dealer_score"] = dealer_value
        elif action == "double" and player == "player":
            # Double down - hit once then stand
            deck = game_state.get("deck", [])
            if deck:
                game_state["player_hand"].append(deck.pop())
                game_state["player_score"] = calculate_blackjack_value(game_state["player_hand"])
                
                # Dealer plays
                dealer_hand = game_state.get("dealer_hand", [])
                dealer_value = calculate_blackjack_value(dealer_hand)
                while dealer_value < 17 and deck:
                    dealer_hand.append(deck.pop())
                    dealer_value = calculate_blackjack_value(dealer_hand)
                game_state["dealer_hand"] = dealer_hand
                game_state["dealer_score"] = dealer_value
        elif action == "hit" and player == "ai":
            # AI dealer hits (this shouldn't normally be called since dealer auto-plays)
            deck = game_state.get("deck", [])
            if deck:
                game_state["dealer_hand"].append(deck.pop())
                game_state["dealer_score"] = calculate_blackjack_value(game_state["dealer_hand"])
    
    elif game_type == "uno":
        action = move.get("action")
        card = move.get("card")
        wild_color = move.get("wild_color")
        
        if player == "player":
            if action == "play" and card in game_state.get("player_hand", []):
                # Validate card can be played
                top_card = game_state.get("top_card", "")
                current_color = game_state.get("current_color", "R")
                draw_stack = game_state.get("draw_stack", 0)
                can_play = False
                
                # If there's a draw stack, player MUST play a draw card or draw
                if draw_stack > 0:
                    if card.endswith('DRAW2') or card == 'WILDDRAW4':
                        can_play = True
                    else:
                        return  # Invalid move - must play draw card or draw
                
                # Wild cards can always be played
                elif card.startswith('WILD'):
                    can_play = True
                    if wild_color:
                        game_state["current_color"] = wild_color
                    
                    # Add to draw stack if Wild Draw Four
                    if card == 'WILDDRAW4':
                        game_state["draw_stack"] = game_state.get("draw_stack", 0) + 4
                
                # Regular cards - check color or value match
                elif top_card:
                    card_color = card[0] if card[0] in ['R', 'G', 'B', 'Y'] else None
                    
                    # Extract card type
                    if card_color:
                        card_type = card[1:]  # Everything after color
                        top_type = top_card[1:] if len(top_card) > 1 else ""
                        
                        # Match color or type
                        if card_color == current_color or card_type == top_type:
                            can_play = True
                            game_state["current_color"] = card_color
                            
                            # Handle Draw Two
                            if card.endswith('DRAW2'):
                                game_state["draw_stack"] = game_state.get("draw_stack", 0) + 2
                            
                            # Handle Reverse
                            elif card.endswith('REVERSE'):
                                game_state["direction"] = -game_state.get("direction", 1)
                            
                            # Handle Skip (AI will skip next turn)
                            elif card.endswith('SKIP'):
                                pass  # Skip is handled in turn management
                else:
                    can_play = True
                
                if can_play:
                    game_state["player_hand"].remove(card)
                    game_state["top_card"] = card
                    
            elif action == "draw":
                import secrets
                deck = game_state.get("deck", [])
                draw_stack = game_state.get("draw_stack", 0)
                
                # Draw penalty cards if stack exists
                cards_to_draw = max(1, draw_stack)
                for _ in range(cards_to_draw):
                    if deck:
                        new_card = deck.pop()
                        game_state["player_hand"].append(new_card)
                    else:
                        # Reshuffle if deck empty (simplified)
                        colors = ['R', 'G', 'B', 'Y']
                        new_card = f"{secure_random.choice(colors)}{secrets.randbelow(9)}"
                        game_state["player_hand"].append(new_card)
                
                game_state["draw_stack"] = 0  # Reset draw stack
                game_state["deck_count"] = len(deck)
                
        else:  # AI turn
            if action == "play":
                ai_hand = game_state.get("ai_hand", [])
                if card and card in ai_hand:
                    ai_hand.remove(card)
                    game_state["ai_hand"] = ai_hand
                    game_state["ai_hand_count"] = len(ai_hand)
                    game_state["top_card"] = card
                    
                    # Handle wild card color
                    if card.startswith('WILD'):
                        if wild_color:
                            game_state["current_color"] = wild_color
                        if card == 'WILDDRAW4':
                            game_state["draw_stack"] = game_state.get("draw_stack", 0) + 4
                    
                    # Handle colored cards
                    elif card[0] in ['R', 'G', 'B', 'Y']:
                        game_state["current_color"] = card[0]
                        
                        if card.endswith('DRAW2'):
                            game_state["draw_stack"] = game_state.get("draw_stack", 0) + 2
                        elif card.endswith('REVERSE'):
                            game_state["direction"] = -game_state.get("direction", 1)
                            
            elif action == "draw":
                import secrets
                deck = game_state.get("deck", [])
                ai_hand = game_state.get("ai_hand", [])
                draw_stack = game_state.get("draw_stack", 0)
                
                cards_to_draw = max(1, draw_stack)
                for _ in range(cards_to_draw):
                    if deck:
                        new_card = deck.pop()
                        ai_hand.append(new_card)
                    else:
                        colors = ['R', 'G', 'B', 'Y']
                        new_card = f"{secure_random.choice(colors)}{secrets.randbelow(9)}"
                        ai_hand.append(new_card)
                
                game_state["ai_hand"] = ai_hand
                game_state["ai_hand_count"] = len(ai_hand)
                game_state["draw_stack"] = 0
                game_state["deck_count"] = len(deck)
    
    elif game_type == "go_fish":
        action = move.get("action")
        if action == "draw" and player == "player":
            suits = ['H', 'D', 'C', 'S']
            ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
            new_card = f"{secure_random.choice(ranks)}{secure_random.choice(suits)}"
            game_state["player_hand"].append(new_card)
    
    elif game_type == "crazy_eights":
        action = move.get("action")
        card = move.get("card")
        
        if player == "player":
            if action == "play" and card in game_state.get("player_hand", []):
                game_state["player_hand"].remove(card)
                game_state["top_card"] = card
            elif action == "draw":
                suits = ['H', 'D', 'C', 'S']
                ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
                new_card = f"{secure_random.choice(ranks)}{secure_random.choice(suits)}"
                game_state["player_hand"].append(new_card)
    
    elif game_type == "hearts":
        card = move.get("card")
        if card:
            if player == "player" and card in game_state.get("player_hand", []):
                game_state["player_hand"].remove(card)
                game_state["current_trick"].append({"player": "player", "card": card})
                
                # Check if trick is complete (2 players)
                if len(game_state["current_trick"]) == 2:
                    # Determine trick winner
                    lead_card = game_state["current_trick"][0]["card"]
                    follow_card = game_state["current_trick"][1]["card"]
                    lead_suit = lead_card[-1]
                    
                    # Winner is whoever played highest card in lead suit
                    lead_rank_order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
                    if follow_card[-1] == lead_suit:
                        lead_rank = lead_rank_order.index(lead_card[:-1])
                        follow_rank = lead_rank_order.index(follow_card[:-1])
                        winner = "player" if follow_rank > lead_rank else "ai"
                    else:
                        winner = "player" if game_state["current_trick"][0]["player"] == "player" else "ai"
                    
                    # Calculate points in trick
                    points = 0
                    for play in game_state["current_trick"]:
                        c = play["card"]
                        if c[-1] == 'H':
                            points += 1
                        elif c == 'QS':
                            points += 13
                    
                    # Award points
                    if winner == "player":
                        game_state["player_score"] = game_state.get("player_score", 0) + points
                    else:
                        game_state["ai_score"] = game_state.get("ai_score", 0) + points
                    
                    # Clear trick
                    game_state["current_trick"] = []
            elif player == "ai":
                ai_hand = game_state.get("ai_hand", [])
                if card in ai_hand:
                    game_state["ai_hand"].remove(card)
                game_state["current_trick"].append({"player": "ai", "card": card})
                
                # Check if trick is complete
                if len(game_state["current_trick"]) == 2:
                    lead_card = game_state["current_trick"][0]["card"]
                    follow_card = game_state["current_trick"][1]["card"]
                    lead_suit = lead_card[-1]
                    
                    lead_rank_order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
                    if follow_card[-1] == lead_suit:
                        lead_rank = lead_rank_order.index(lead_card[:-1])
                        follow_rank = lead_rank_order.index(follow_card[:-1])
                        winner = "ai" if follow_rank > lead_rank else "player"
                    else:
                        winner = "ai" if game_state["current_trick"][0]["player"] == "ai" else "player"
                    
                    points = 0
                    for play in game_state["current_trick"]:
                        c = play["card"]
                        if c[-1] == 'H':
                            points += 1
                        elif c == 'QS':
                            points += 13
                    
                    if winner == "player":
                        game_state["player_score"] = game_state.get("player_score", 0) + points
                    else:
                        game_state["ai_score"] = game_state.get("ai_score", 0) + points
                    
                    game_state["current_trick"] = []
    
    elif game_type == "poker":
        action = move.get("action")
        if action == "fold":
            game_state["player_folded"] = True
        elif action == "call":
            game_state["player_chips"] = game_state.get("player_chips", 900) - game_state.get("current_bet", 10)
            game_state["pot"] = game_state.get("pot", 100) + game_state.get("current_bet", 10)
        elif action == "raise":
            raise_amount = game_state.get("current_bet", 10) * 2
            game_state["player_chips"] = game_state.get("player_chips", 900) - raise_amount
            game_state["pot"] = game_state.get("pot", 100) + raise_amount
            game_state["current_bet"] = raise_amount
    
    elif game_type == "spades":
        action = move.get("action")
        
        if action == "bid":
            # Handle bidding
            bid = move.get("bid", 0)
            game_state["bids"]["player"] = bid
            
            # AI bids (simple logic - count high cards)
            for ai_player in ["partner", "opp1", "opp2"]:
                hand = game_state.get(f"{ai_player}_hand", [])
                high_cards = sum(1 for card in hand if card['value'] >= 11)
                spades_count = sum(1 for card in hand if card['suit'] == 'spades')
                game_state["bids"][ai_player] = min(high_cards + spades_count // 3, 13)
            
            # Calculate team bids
            game_state["team_bids"]["team1"] = game_state["bids"]["player"] + game_state["bids"]["partner"]
            game_state["team_bids"]["team2"] = game_state["bids"]["opp1"] + game_state["bids"]["opp2"]
            
            # Move to playing phase
            game_state["phase"] = "playing"
            
        elif action == "play_card":
            # Handle card play
            card = move.get("card")
            if card and player == "player":
                player_hand = game_state.get("player_hand", [])
                # Remove card from hand
                game_state["player_hand"] = [c for c in player_hand 
                                             if not (c['suit'] == card['suit'] and c['rank'] == card['rank'])]
                
                # Add to current trick
                game_state["current_trick"].append({
                    "player": "player",
                    "card": card
                })
                
                # Check if spades broken
                if card['suit'] == 'spades' and len(game_state["current_trick"]) > 1:
                    game_state["spades_broken"] = True
                
                # If trick is complete (4 cards), determine winner
                if len(game_state["current_trick"]) == 4:
                    trick = game_state["current_trick"]
                    led_suit = trick[0]['card']['suit']
                    
                    # Find highest trump (spade) or highest card in led suit
                    winner_idx = 0
                    highest_value = trick[0]['card']['value']
                    winner_suit = trick[0]['card']['suit']
                    
                    for i in range(1, 4):
                        card_suit = trick[i]['card']['suit']
                        card_value = trick[i]['card']['value']
                        
                        # Spades trump everything
                        if card_suit == 'spades' and winner_suit != 'spades':
                            winner_idx = i
                            highest_value = card_value
                            winner_suit = card_suit
                        elif card_suit == 'spades' and winner_suit == 'spades' and card_value > highest_value:
                            winner_idx = i
                            highest_value = card_value
                        elif card_suit == led_suit and winner_suit == led_suit and card_value > highest_value:
                            winner_idx = i
                            highest_value = card_value
                        elif card_suit == led_suit and winner_suit != 'spades' and winner_suit != led_suit:
                            winner_idx = i
                            highest_value = card_value
                            winner_suit = card_suit
                    
                    # Award trick
                    winner_player = trick[winner_idx]['player']
                    game_state["tricks_won"][winner_player] = game_state["tricks_won"].get(winner_player, 0) + 1
                    
                    # Clear trick
                    game_state["current_trick"] = []
                    
                    # Check if all tricks played (13 tricks)
                    total_tricks = sum(game_state["tricks_won"].values())
                    if total_tricks == 13:
                        # Scoring phase
                        game_state["phase"] = "scoring"
                        
                        # Calculate scores
                        team1_tricks = game_state["tricks_won"]["player"] + game_state["tricks_won"]["partner"]
                        team2_tricks = game_state["tricks_won"]["opp1"] + game_state["tricks_won"]["opp2"]
                        
                        team1_bid = game_state["team_bids"]["team1"]
                        team2_bid = game_state["team_bids"]["team2"]
                        
                        # Team 1 scoring
                        if team1_tricks >= team1_bid:
                            points = team1_bid * 10
                            bags = team1_tricks - team1_bid
                            game_state["team_scores"]["team1"] += points + bags
                            game_state["bags"]["team1"] += bags
                            
                            # Bag penalty (every 10 bags = -100 points)
                            if game_state["bags"]["team1"] >= 10:
                                game_state["team_scores"]["team1"] -= 100
                                game_state["bags"]["team1"] -= 10
                        else:
                            # Underbid penalty
                            game_state["team_scores"]["team1"] -= team1_bid * 10
                        
                        # Team 2 scoring (same logic)
                        if team2_tricks >= team2_bid:
                            points = team2_bid * 10
                            bags = team2_tricks - team2_bid
                            game_state["team_scores"]["team2"] += points + bags
                            game_state["bags"]["team2"] += bags
                            
                            if game_state["bags"]["team2"] >= 10:
                                game_state["team_scores"]["team2"] -= 100
                                game_state["bags"]["team2"] -= 10
                        else:
                            game_state["team_scores"]["team2"] -= team2_bid * 10
                        
                        # Check for game end (first to 200)
                        if game_state["team_scores"]["team1"] >= 200 or game_state["team_scores"]["team2"] >= 200:
                            game_state["phase"] = "finished"
    
    
    # ==================== NEW GAMES MOVES ====================
    
    elif game_type == "trivia":
        # Handle trivia answer
        answer = move.get("answer")
        question_index = move.get("question_index", game_state["current_question_index"])
        
        if answer and question_index < len(game_state["questions"]):
            correct = move.get("is_correct", False)
            time_taken = move.get("time_taken", 15)
            
            # Calculate points (faster = more points)
            points = 100 if correct else 0
            if correct and time_taken < 10:
                points += 50  # Speed bonus
            
            if player == "player":
                game_state["player_score"] += points
            else:
                game_state["ai_score"] += points
            
            game_state["answered_questions"].append({
                "question_index": question_index,
                "player_answer": answer,
                "correct": correct,
                "points": points
            })
            
            game_state["current_question_index"] += 1
    
    elif game_type == "truthordare":
        # Handle truth or dare response
        action = move.get("action")
        
        if action == "choose":
            # Player chooses truth or dare
            choice = move.get("choice")  # 'truth' or 'dare'
            game_state["challenge_type"] = choice
            
        elif action == "complete":
            # Player completed the challenge
            completed = move.get("completed", False)
            
            if completed:
                if player == "player":
                    game_state["player_score"] += 100
                else:
                    game_state["ai_score"] += 100
                
                game_state["completed_challenges"].append({
                    "round": game_state["current_round"],
                    "type": game_state["challenge_type"],
                    "challenge": game_state["current_challenge"],
                    "completed": True
                })
            
            game_state["current_round"] += 1
            game_state["current_challenge"] = None
            game_state["challenge_type"] = None
            
        elif action == "skip":
            # Player skips
            if game_state["skips_remaining"] > 0:
                game_state["skips_remaining"] -= 1
                game_state["current_challenge"] = None
                game_state["challenge_type"] = None
    
    elif game_type == "rummy":
        # Handle rummy moves
        action = move.get("action")
        
        if action == "draw":
            source = move.get("source")  # 'deck' or 'discard'
            if source == "discard" and game_state["discard_pile"]:
                card = game_state["discard_pile"][-1]
                game_state["discard_pile"].pop()
                if player == "player":
                    game_state["player_hand"].append(card)
            
            game_state["current_action"] = "discard"
            
        elif action == "discard":
            card_index = move.get("card_index")
            if player == "player" and card_index is not None:
                if 0 <= card_index < len(game_state["player_hand"]):
                    card = game_state["player_hand"].pop(card_index)
                    game_state["discard_pile"].append(card)
            
            game_state["current_action"] = "draw"
        
        elif action == "declare":
            # Player declares (melded all cards)
            if player == "player":
                game_state["winner"] = "player"

    return game_state

def check_game_status(game_type: str, game_state: Dict) -> Dict:
    """Check if game has ended and who won"""
    if game_type == "tictactoe":
        board = game_state["board"]
        
        # Check rows, columns, diagonals
        for i in range(3):
            if board[i][0] == board[i][1] == board[i][2] != "":
                return {"ended": True, "winner": "player" if board[i][0] == "X" else "ai", "message": f"{board[i][0]} wins!"}
        
        for j in range(3):
            if board[0][j] == board[1][j] == board[2][j] != "":
                return {"ended": True, "winner": "player" if board[0][j] == "X" else "ai", "message": f"{board[0][j]} wins!"}
        
        if board[0][0] == board[1][1] == board[2][2] != "":
            return {"ended": True, "winner": "player" if board[0][0] == "X" else "ai", "message": f"{board[0][0]} wins!"}
        if board[0][2] == board[1][1] == board[2][0] != "":
            return {"ended": True, "winner": "player" if board[0][2] == "X" else "ai", "message": f"{board[0][2]} wins!"}
        
        # Check draw
        if all(board[i][j] != "" for i in range(3) for j in range(3)):
            return {"ended": True, "winner": "draw", "message": "It's a draw!"}
    
    elif game_type == "connect4":
        board = game_state["board"]
        
        # Check horizontal wins
        for row in range(6):
            for col in range(4):
                if board[row][col] != "" and board[row][col] == board[row][col+1] == board[row][col+2] == board[row][col+3]:
                    winner = "player" if board[row][col] == "red" else "ai"
                    return {"ended": True, "winner": winner, "message": f"{'Red' if board[row][col] == 'red' else 'Yellow'} wins!"}
        
        # Check vertical wins
        for row in range(3):
            for col in range(7):
                if board[row][col] != "" and board[row][col] == board[row+1][col] == board[row+2][col] == board[row+3][col]:
                    winner = "player" if board[row][col] == "red" else "ai"
                    return {"ended": True, "winner": winner, "message": f"{'Red' if board[row][col] == 'red' else 'Yellow'} wins!"}
        
        # Check diagonal wins (bottom-left to top-right)
        for row in range(3):
            for col in range(4):
                if board[row][col] != "" and board[row][col] == board[row+1][col+1] == board[row+2][col+2] == board[row+3][col+3]:
                    winner = "player" if board[row][col] == "red" else "ai"
                    return {"ended": True, "winner": winner, "message": f"{'Red' if board[row][col] == 'red' else 'Yellow'} wins!"}
        
        # Check diagonal wins (top-left to bottom-right)
        for row in range(3, 6):
            for col in range(4):
                if board[row][col] != "" and board[row][col] == board[row-1][col+1] == board[row-2][col+2] == board[row-3][col+3]:
                    winner = "player" if board[row][col] == "red" else "ai"
                    return {"ended": True, "winner": winner, "message": f"{'Red' if board[row][col] == 'red' else 'Yellow'} wins!"}
        
        # Check draw (board full)
        if all(board[0][col] != "" for col in range(7)):
            return {"ended": True, "winner": "draw", "message": "It's a draw!"}
    
    elif game_type == "blackjack":
        player_hand = game_state.get("player_hand", [])
        dealer_hand = game_state.get("dealer_hand", [])
        player_value = calculate_blackjack_value(player_hand)
        dealer_value = calculate_blackjack_value(dealer_hand)
        
        # Player busted
        if player_value > 21:
            return {"ended": True, "winner": "ai", "message": "Player busts! Dealer wins!"}
        
        # Check if dealer has played (dealer_value >= 17 or dealer busted)
        # This happens after player stands
        if dealer_value >= 17 or len(dealer_hand) > 2:
            if dealer_value > 21:
                return {"ended": True, "winner": "player", "message": "Dealer busts! You win!"}
            elif player_value > dealer_value:
                return {"ended": True, "winner": "player", "message": "You win!"}
            elif player_value < dealer_value:
                return {"ended": True, "winner": "ai", "message": "Dealer wins!"}
            else:
                return {"ended": True, "winner": "push", "message": "Push! It's a tie!"}
    
    elif game_type == "uno":
        player_hand = game_state.get("player_hand", [])
        ai_hand_count = game_state.get("ai_hand_count", 7)
        
        if len(player_hand) == 0:
            return {"ended": True, "winner": "player", "message": "UNO! You win!"}
        elif ai_hand_count == 0:
            return {"ended": True, "winner": "ai", "message": "AI wins!"}
    
    elif game_type == "hearts":
        player_score = game_state.get("player_score", 0)
        ai_score = game_state.get("ai_score", 0)
        player_hand = game_state.get("player_hand", [])
        
        # Game ends when all cards are played or score reaches 100
        if len(player_hand) == 0:
            if player_score < ai_score:
                return {"ended": True, "winner": "player", "message": f"You win! {player_score} to {ai_score}"}
            elif ai_score < player_score:
                return {"ended": True, "winner": "ai", "message": f"AI wins! {ai_score} to {player_score}"}
            else:
                return {"ended": True, "winner": "draw", "message": "It's a tie!"}
        
        if player_score >= 100:
            return {"ended": True, "winner": "ai", "message": "AI wins! You reached 100 points."}
        elif ai_score >= 100:
            return {"ended": True, "winner": "player", "message": "You win! AI reached 100 points."}
    
    elif game_type == "checkers":
        board = game_state.get("board", [])
        player_pieces = sum(1 for row in board for cell in row if isinstance(cell, dict) and cell.get("player") == "player")
        ai_pieces = sum(1 for row in board for cell in row if isinstance(cell, dict) and cell.get("player") == "ai")
        
        if player_pieces == 0:
            return {"ended": True, "winner": "ai", "message": "AI wins! All your pieces are captured!"}
        elif ai_pieces == 0:
            return {"ended": True, "winner": "player", "message": "You win! All AI pieces captured!"}
    
    elif game_type == "reversi":
        board = game_state.get("board", [])
        
        # Check if board is full or no valid moves for either player
        empty_cells = sum(1 for row in board for cell in row if cell == "")
        
        if empty_cells == 0:
            # Count pieces
            player_count = sum(1 for row in board for cell in row if cell == "player")
            ai_count = sum(1 for row in board for cell in row if cell == "ai")
            
            if player_count > ai_count:
                return {"ended": True, "winner": "player", "message": f"You win! {player_count} to {ai_count}"}
            elif ai_count > player_count:
                return {"ended": True, "winner": "ai", "message": f"AI wins! {ai_count} to {player_count}"}
            else:
                return {"ended": True, "winner": "draw", "message": "It's a tie!"}
    
    elif game_type == "chess":
        # Chess uses python-chess library which handles checkmate detection
        # We'll check for game ending indicators in state
        if "checkmate" in game_state or game_state.get("checkmate"):
            winner = game_state.get("winner", "ai")
            return {"ended": True, "winner": winner, "message": "Checkmate!"}
    
    # ==================== NEW GAMES STATUS ====================
    
    elif game_type == "trivia":
        # Check if all questions answered
        if game_state["current_question_index"] >= 10:
            player_score = game_state["player_score"]
            ai_score = game_state["ai_score"]
            
            if player_score > ai_score:
                return {"ended": True, "winner": "player", "message": f"You win! Score: {player_score} vs {ai_score}"}
            elif ai_score > player_score:
                return {"ended": True, "winner": "ai", "message": f"AI wins! Score: {ai_score} vs {player_score}"}
            else:
                return {"ended": True, "winner": "draw", "message": f"It's a tie! Both scored {player_score}"}
    
    elif game_type == "truthordare":
        # Check if game reached max rounds (10 rounds)
        if game_state["current_round"] > 10:
            player_score = game_state["player_score"]
            ai_score = game_state["ai_score"]
            
            if player_score > ai_score:
                return {"ended": True, "winner": "player", "message": f"You completed more challenges! {player_score} points"}
            elif ai_score > player_score:
                return {"ended": True, "winner": "ai", "message": f"AI completed more! {ai_score} points"}
            else:
                return {"ended": True, "winner": "draw", "message": "Equal effort! It's a tie!"}
    
    elif game_type == "rummy":
        # Check if someone won
        if game_state.get("winner"):
            winner = game_state["winner"]
            return {"ended": True, "winner": winner, "message": f"{'You' if winner == 'player' else 'AI'} win! All cards melded!"}
        
        # Check if someone has 0 cards (declared and melded)
        if len(game_state.get("player_hand", [])) == 0:
            return {"ended": True, "winner": "player", "message": "You win! All cards melded!"}

    

    # ==================== NEW GAMES ====================
    
    elif game_type == "trivia":
        # Initialize trivia game - fetch 10 questions from OpenTriviaDB
        return {
            "questions": [],  # Will be fetched on first load
            "current_question_index": 0,
            "player_score": 0,
            "ai_score": 0,
            "answered_questions": []
        }
    
    elif game_type == "truthordare":
        # Initialize Truth or Dare game
        return {
            "current_round": 1,
            "player_score": 0,
            "ai_score": 0,
            "skips_remaining": 3,
            "completed_challenges": [],
            "current_challenge": None,
            "challenge_type": None  # 'truth' or 'dare'
        }
    
    elif game_type == "rummy":
        # Initialize Rummy game (Indian Rummy - 13 cards)
        deck = create_deck()
        secure_random.shuffle(deck)
        
        player_hand = deck[:13]
        discard_pile = [deck[26]]
        draw_pile = deck[27:]
        
        return {
            "player_hand": player_hand,
            "ai_hand_count": 13,
            "discard_pile": discard_pile,
            "draw_pile_count": len(draw_pile),
            "player_score": 0,
            "ai_score": 0,
            "current_action": "draw"  # 'draw' or 'discard'
        }
    
    return {}

def create_deck():
    """Create a standard 52-card deck"""
    suits = ['♠', '♥', '♦', '♣']
    ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
    deck = []
    for suit in suits:
        for rank in ranks:
            deck.append(f"{rank}{suit}")
    return deck

async def fetch_trivia_questions() -> Dict[str, Any]:
    """Fetch trivia questions from OpenTriviaDB"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://opentdb.com/api.php?amount=10&type=multiple",
                timeout=10.0
            )
            data = response.json()
            
            if data["response_code"] == 0:
                questions = []
                for q in data["results"]:
                    questions.append({
                        "question": q["question"],
                        "correct_answer": q["correct_answer"],
                        "incorrect_answers": q["incorrect_answers"],
                        "category": q["category"],
                        "difficulty": q["difficulty"]
                    })
                return questions
            return []
    except Exception as e:
        print(f"Error fetching trivia: {e}")
        return []

async def generate_truth_or_dare(challenge_type: str) -> Dict[str, Any]:
    """Generate Truth or Dare challenge using Gemini AI"""
    try:
        api_key = os.getenv("EMERGENT_LLM_KEY")
        chat = LlmChat(
            api_key=api_key,
            session_id=f"truthordare_{uuid.uuid4().hex[:8]}",
            system_message="You are a creative dating game host. Generate fun, engaging, and appropriate truth questions or dare challenges for a dating app. Keep them flirty but respectful."
        ).with_model("gemini", "gemini-2.5-flash")
        
        if challenge_type == "truth":
            prompt = "Generate one creative, fun truth question for a dating icebreaker game. Make it engaging and helps people get to know each other. Return ONLY the question, no extra text."
        else:  # dare
            prompt = "Generate one fun, lighthearted dare challenge for a dating game. Make it something they can do right now (like take a selfie, send a voice message, share a story). Return ONLY the dare, no extra text."
        
        message = UserMessage(text=prompt)
        response = await chat.send_message(message)
        
        return response.strip()
    except Exception as e:
        print(f"Error generating challenge: {e}")
        # Fallback questions
        if challenge_type == "truth":
            truths = [
                "What's your idea of a perfect first date?",
                "What's the most spontaneous thing you've ever done?",
                "If you could have dinner with anyone, who would it be?",
                "What's your guilty pleasure TV show?",
                "What's one thing on your bucket list?"
            ]
            return secure_random.choice(truths)
        else:
            dares = [
                "Send a voice message singing your favorite song for 10 seconds",
                "Take a funny selfie and describe why you chose that expression",
                "Share your most embarrassing dating story",
                "Do your best celebrity impression",
                "Tell a joke and rate yourself out of 10"
            ]
            return secure_random.choice(dares)

    return {"ended": False}



# ==================== CASINO GAMES - SERVER AUTHORITATIVE ====================

class CasinoBetRequest(BaseModel):
    game_type: str  # craps, sicbo, roulette, bingo, etc.
    bet_amount: int
    bet_data: Dict  # Game-specific bet data

class CasinoSpinRequest(BaseModel):
    game_id: str

@router.post("/casino/bet")
async def place_casino_bet(bet_request: CasinoBetRequest, request: Request) -> Dict[str, Any]:
    """Place a bet in a casino game - Server authoritative"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    game_id = f"casino_{uuid.uuid4().hex[:12]}"
    db = get_database()
    
    # Validate bet amount
    if bet_request.bet_amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid bet amount")
    
    # Create game session
    casino_session = {
        "game_id": game_id,
        "user_id": current_user.user_id,
        "game_type": bet_request.game_type,
        "bet_amount": bet_request.bet_amount,
        "bet_data": bet_request.bet_data,
        "status": "betting",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.casino_sessions.insert_one(casino_session)
    
    return {
        "game_id": game_id,
        "status": "betting",
        "message": "Bet placed successfully"
    }

@router.post("/casino/spin")
async def execute_casino_spin(spin_request: CasinoSpinRequest, request: Request) -> Dict[str, Any]:
    """Execute casino game spin/roll - Server generates result"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    session = await db.casino_sessions.find_one(
        {"game_id": spin_request.game_id, "user_id": current_user.user_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Casino session not found")
    
    if session["status"] != "betting":
        raise HTTPException(status_code=400, detail="Invalid session status")
    
    game_type = session["game_type"]
    bet_data = session["bet_data"]
    bet_amount = session["bet_amount"]
    
    # Generate server-authoritative result
    if game_type == "craps":
        result = generate_craps_result(bet_data)
    elif game_type == "sicbo":
        result = generate_sicbo_result(bet_data)
    elif game_type == "roulette":
        result = generate_roulette_result(bet_data)
    elif game_type == "bingo":
        result = generate_bingo_result()
    elif game_type == "fantan":
        result = generate_fantan_result(bet_data)
    elif game_type == "paigow":
        result = generate_paigow_result()
    elif game_type == "mahjong":
        result = generate_mahjong_result()
    else:
        raise HTTPException(status_code=400, detail=f"Game type {game_type} not supported")
    
    # Calculate payout
    payout = calculate_payout(game_type, bet_data, result, bet_amount)
    
    # Update session
    await db.casino_sessions.update_one(
        {"game_id": spin_request.game_id},
        {"$set": {
            "status": "completed",
            "result": result,
            "payout": payout,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "game_id": spin_request.game_id,
        "game_type": game_type,
        "result": result,
        "payout": payout,
        "net_win": payout - bet_amount
    }


# ==================== CASINO GAME LOGIC - SERVER AUTHORITATIVE RNG ====================

def generate_craps_result(bet_data: Dict) -> Dict:
    """Generate server-authoritative Craps dice roll"""
    import secrets
    
    # Use cryptographically secure random for fairness
    dice1 = secrets.randbelow(6) + 1
    dice2 = secrets.randbelow(6) + 1
    total = dice1 + dice2
    
    return {
        "dice": [dice1, dice2],
        "total": total,
        "is_natural": total in [7, 11],
        "is_craps": total in [2, 3, 12]
    }

def generate_sicbo_result(bet_data: Dict) -> Dict:
    """Generate server-authoritative Sic Bo (3 dice) roll"""
    import secrets
    
    dice = [secrets.randbelow(6) + 1 for _ in range(3)]
    total = sum(dice)
    
    return {
        "dice": dice,
        "total": total,
        "is_triple": len(set(dice)) == 1,
        "is_double": len(set(dice)) == 2
    }

def generate_roulette_result(bet_data: Dict) -> Dict:
    """Generate server-authoritative Roulette spin"""
    import secrets
    
    # American Roulette: 0, 00, 1-36
    numbers = list(range(0, 37)) + ['00']
    
    # Use secure random selection
    winning_number = secrets.choice(numbers)
    
    # Determine color
    if winning_number in [0, '00']:
        color = 'green'
    else:
        red_numbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
        color = 'red' if winning_number in red_numbers else 'black'
    
    return {
        "number": winning_number,
        "color": color,
        "is_even": winning_number not in [0, '00'] and winning_number % 2 == 0,
        "is_odd": winning_number not in [0, '00'] and winning_number % 2 == 1
    }

def generate_bingo_result() -> Dict:
    """Generate server-authoritative Bingo number draw"""
    import secrets
    
    # Draw a random number from 1-75
    number = secrets.randbelow(75) + 1
    
    # Determine letter (B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75)
    if number <= 15:
        letter = 'B'
    elif number <= 30:
        letter = 'I'
    elif number <= 45:
        letter = 'N'
    elif number <= 60:
        letter = 'G'
    else:
        letter = 'O'
    
    return {
        "number": number,
        "letter": letter,
        "call": f"{letter}{number}"
    }

def generate_fantan_result(bet_data: Dict) -> Dict:
    """Generate server-authoritative Fan Tan bead count"""
    import secrets
    
    # Random bead count (60-100 beads typical)
    bead_count = secrets.randbelow(41) + 60
    remainder = bead_count % 4 or 4  # 1, 2, 3, or 4
    
    return {
        "bead_count": bead_count,
        "remainder": remainder
    }

def generate_paigow_result() -> Dict:
    """Generate server-authoritative Pai Gow tiles"""
    import secrets
    
    # Simplified: Generate 8 tiles (4 player, 4 dealer)
    tiles = list(range(1, 33))  # 32 tiles
    secrets.SystemRandom().shuffle(tiles)
    
    player_tiles = tiles[0:4]
    dealer_tiles = tiles[4:8]
    
    return {
        "player_tiles": player_tiles,
        "dealer_tiles": dealer_tiles
    }

def generate_mahjong_result() -> Dict:
    """Generate server-authoritative Mahjong tile draw"""
    import secrets
    
    # Draw one tile from 144-tile set
    tile_id = secrets.randbelow(144) + 1
    
    # Determine suit and value (simplified)
    if tile_id <= 36:
        suit = "bamboo"
        value = ((tile_id - 1) % 9) + 1
    elif tile_id <= 72:
        suit = "characters"
        value = ((tile_id - 37) % 9) + 1
    elif tile_id <= 108:
        suit = "dots"
        value = ((tile_id - 73) % 9) + 1
    elif tile_id <= 124:
        suit = "winds"
        value = ["E", "S", "W", "N"][((tile_id - 109) % 4)]
    else:
        suit = "dragons"
        value = ["Red", "Green", "White"][((tile_id - 125) % 3)]
    
    return {
        "tile_id": tile_id,
        "suit": suit,
        "value": value
    }


def calculate_payout(game_type: str, bet_data: Dict, result: Dict, bet_amount: int) -> int:
    """Calculate payout based on game type and result"""
    
    if game_type == "craps":
        # Pass Line bet
        if bet_data.get("bet_type") == "pass":
            if result["is_natural"]:
                return bet_amount * 2  # 1:1 payout
            elif result["is_craps"]:
                return 0  # Lose
            else:
                # Point established - simplified
                return bet_amount  # Push for now
        return 0
    
    elif game_type == "sicbo":
        # Example: Specific triple pays 180:1
        if bet_data.get("bet_type") == "specific_triple":
            if result["is_triple"]:
                return bet_amount * 181
        # Small/Big bet
        elif bet_data.get("bet_type") == "small":
            if 4 <= result["total"] <= 10 and not result["is_triple"]:
                return bet_amount * 2
        return 0
    
    elif game_type == "roulette":
        # Straight up bet
        if bet_data.get("bet_type") == "straight":
            if result["number"] == bet_data.get("number"):
                return bet_amount * 36  # 35:1 + original
        # Color bet
        elif bet_data.get("bet_type") == "color":
            if result["color"] == bet_data.get("color"):
                return bet_amount * 2
        return 0
    
    elif game_type == "fantan":
        # Position bet (3:1 payout)
        if bet_data.get("position") == result["remainder"]:
            return bet_amount * 4
        return 0
    
    elif game_type == "paigow":
        # Simplified: Win minus 5% commission
        return int(bet_amount * 1.95)
    
    # Default
    return 0
