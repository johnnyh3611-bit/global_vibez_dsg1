"""
AI Practice Mode - Intelligent Game Opponents
Provides AI opponents with multiple difficulty levels and game-specific strategies
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import secrets
secure_random = secrets.SystemRandom()
import json
import os
from utils.database import get_database
from services.ai_engine import LlmChat, UserMessage

router = APIRouter(prefix="/ai-practice", tags=["ai_practice"])

# LLM for advanced AI
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Pydantic Models
class AIMoveRequest(BaseModel):
    game_type: str  # poker, chess, tictactoe, connect4, etc.
    game_state: Dict[str, Any]
    difficulty: str = "medium"  # easy, medium, hard
    player_history: Optional[List[Dict]] = None

class AIGameStart(BaseModel):
    user_id: str
    game_type: str
    difficulty: str = "medium"

# ========== AI MOVE CALCULATION ==========

@router.post("/calculate-move")
async def calculate_ai_move(request: AIMoveRequest) -> Dict[str, Any]:
    """Calculate AI's next move based on game type and difficulty"""
    try:
        game_type = request.game_type.lower()
        difficulty = request.difficulty.lower()
        
        # Route to game-specific AI
        if game_type == "tictactoe":
            move = calculate_tictactoe_move(request.game_state, difficulty)
        elif game_type == "connect4":
            move = calculate_connect4_move(request.game_state, difficulty)
        elif game_type == "chess":
            move = calculate_chess_move(request.game_state, difficulty)
        elif game_type == "poker":
            move = calculate_poker_move(request.game_state, difficulty)
        elif game_type == "rps":
            move = calculate_rps_move(request.game_state, difficulty, request.player_history)
        elif game_type == "checkers":
            move = calculate_checkers_move(request.game_state, difficulty)
        elif game_type == "battleship":
            move = calculate_battleship_move(request.game_state, difficulty)
        else:
            # Generic AI for other games
            move = calculate_generic_move(request.game_state, difficulty)
        
        return {
            "success": True,
            "move": move,
            "difficulty": difficulty,
            "thinking_time": 500 + secrets.randbelow(1501) if difficulty == "hard" else 100 + secrets.randbelow(401)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ========== TIC-TAC-TOE AI (Minimax) ==========

def calculate_tictactoe_move(game_state: Dict, difficulty: str) -> Dict:
    """Tic-Tac-Toe AI using Minimax algorithm"""
    board = game_state.get("board", [[None]*3 for _ in range(3)])
    ai_symbol = game_state.get("ai_symbol", "O")
    player_symbol = "X" if ai_symbol == "O" else "O"
    
    if difficulty == "easy":
        # Random move
        empty_cells = [(i, j) for i in range(3) for j in range(3) if board[i][j] is None]
        if empty_cells:
            row, col = secure_random.choice(empty_cells)
            return {"row": row, "col": col, "strategy": "random"}
    
    elif difficulty == "medium":
        # 70% optimal, 30% random
        if secure_random.random() < 0.7:
            move = minimax_tictactoe(board, ai_symbol, player_symbol)
            return {**move, "strategy": "calculated"}
        else:
            empty_cells = [(i, j) for i in range(3) for j in range(3) if board[i][j] is None]
            if empty_cells:
                row, col = secure_random.choice(empty_cells)
                return {"row": row, "col": col, "strategy": "random"}
    
    else:  # hard
        # Perfect play using Minimax
        move = minimax_tictactoe(board, ai_symbol, player_symbol)
        return {**move, "strategy": "minimax"}
    
    return {"row": 0, "col": 0}

def minimax_tictactoe(board, ai_symbol, player_symbol):
    """Minimax algorithm for perfect Tic-Tac-Toe play"""
    def check_winner(b, symbol):
        # Check rows, cols, diagonals
        for i in range(3):
            if all(b[i][j] == symbol for j in range(3)):
                return True
            if all(b[j][i] == symbol for j in range(3)):
                return True
        if all(b[i][i] == symbol for i in range(3)):
            return True
        if all(b[i][2-i] == symbol for i in range(3)):
            return True
        return False
    
    def minimax(b, is_maximizing):
        if check_winner(b, ai_symbol):
            return 10
        if check_winner(b, player_symbol):
            return -10
        if all(b[i][j] is not None for i in range(3) for j in range(3)):
            return 0
        
        if is_maximizing:
            best_score = -1000
            for i in range(3):
                for j in range(3):
                    if b[i][j] is None:
                        b[i][j] = ai_symbol
                        score = minimax(b, False)
                        b[i][j] = None
                        best_score = max(score, best_score)
            return best_score
        else:
            best_score = 1000
            for i in range(3):
                for j in range(3):
                    if b[i][j] is None:
                        b[i][j] = player_symbol
                        score = minimax(b, True)
                        b[i][j] = None
                        best_score = min(score, best_score)
            return best_score
    
    best_score = -1000
    best_move = None
    for i in range(3):
        for j in range(3):
            if board[i][j] is None:
                board[i][j] = ai_symbol
                score = minimax(board, False)
                board[i][j] = None
                if score > best_score:
                    best_score = score
                    best_move = (i, j)
    
    return {"row": best_move[0], "col": best_move[1]} if best_move else {"row": 0, "col": 0}

# ========== CONNECT 4 AI ==========

def calculate_connect4_move(game_state: Dict, difficulty: str) -> Dict:
    """Connect 4 AI with column evaluation"""
    board = game_state.get("board", [[None]*7 for _ in range(6)])
    # ai_symbol = game_state.get("ai_symbol", "O")  # Unused
    
    def get_valid_columns():
        return [col for col in range(7) if board[0][col] is None]
    
    def evaluate_column(col):
        # Drop piece and evaluate position
        for row in range(5, -1, -1):
            if board[row][col] is None:
                # Check if this creates a win or blocks opponent
                score = 0
                # Center column preference
                score += (3 - abs(col - 3)) * 2
                return score
        return -1000
    
    valid_cols = get_valid_columns()
    if not valid_cols:
        return {"column": 3}
    
    if difficulty == "easy":
        return {"column": secure_random.choice(valid_cols), "strategy": "random"}
    
    elif difficulty == "medium":
        # Evaluate columns with some randomness
        scores = [(col, evaluate_column(col) + 0 + secrets.randbelow(6)) for col in valid_cols]
        best_col = max(scores, key=lambda x: x[1])[0]
        return {"column": best_col, "strategy": "positional"}
    
    else:  # hard
        # Advanced evaluation
        scores = [(col, evaluate_column(col)) for col in valid_cols]
        best_col = max(scores, key=lambda x: x[1])[0]
        return {"column": best_col, "strategy": "advanced"}

# ========== CHESS AI (Simplified) ==========

def calculate_chess_move(game_state: Dict, difficulty: str) -> Dict:
    """Simplified Chess AI - piece value evaluation"""
    # Note: Full chess AI is complex, this is a basic implementation
    # In production, use a chess engine like Stockfish or python-chess
    
    # Unused piece values (commented out for now)
    # piece_values = {
    #     'pawn': 1, 'knight': 3, 'bishop': 3,
    #     'rook': 5, 'queen': 9, 'king': 100
    # }
    
    available_moves = game_state.get("legal_moves", [])
    
    if not available_moves:
        return {"move": "resign", "strategy": "no_moves"}
    
    if difficulty == "easy":
        return {"move": secure_random.choice(available_moves), "strategy": "random"}
    
    elif difficulty == "medium":
        # Prefer captures and center control
        captures = [m for m in available_moves if m.get("captures")]
        if captures and secure_random.random() < 0.7:
            return {"move": secure_random.choice(captures), "strategy": "tactical"}
        return {"move": secure_random.choice(available_moves), "strategy": "positional"}
    
    else:  # hard - use AI
        return calculate_chess_ai_move(game_state)

def calculate_chess_ai_move(game_state: Dict) -> Dict:
    """Use Gemini AI for advanced chess move calculation"""
    try:
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"chess_ai_{1000 + secrets.randbelow(9000)}",
            system_message="You are a chess expert. Analyze positions and suggest the best move."
        ).with_model("gemini", "gemini-2.5-flash")
        
        prompt = f"""Given this chess position:
        {json.dumps(game_state.get('board', []))}
        
        Legal moves: {game_state.get('legal_moves', [])[:10]}
        
        Suggest the best move in chess notation. Consider:
        1. Material advantage
        2. King safety
        3. Center control
        4. Piece activity
        
        Respond with just the move notation (e.g., "e4" or "Nf3")."""
        
        response = llm.ask(UserMessage(prompt))
        move = response.content.strip()
        
        return {"move": move, "strategy": "ai_calculated"}
    except Exception:
        # Fallback to random move
        available_moves = game_state.get("legal_moves", [])
        return {"move": secure_random.choice(available_moves) if available_moves else "e4", "strategy": "fallback"}

# ========== POKER AI ==========

def calculate_poker_move(game_state: Dict, difficulty: str) -> Dict:
    """Poker AI - hand evaluation and betting strategy"""
    hand = game_state.get("hand", [])
    community_cards = game_state.get("community_cards", [])
    pot = game_state.get("pot", 0)
    current_bet = game_state.get("current_bet", 0)
    player_chips = game_state.get("ai_chips", 1000)
    
    # Calculate hand strength (simplified)
    hand_strength = evaluate_poker_hand_strength(hand, community_cards)
    
    if difficulty == "easy":
        # Random play with high fold rate
        if hand_strength < 0.3:
            return {"action": "fold", "amount": 0}
        elif secure_random.random() < 0.5:
            return {"action": "call", "amount": current_bet}
        else:
            return {"action": "raise", "amount": current_bet + pot // 4}
    
    elif difficulty == "medium":
        # Based on hand strength
        if hand_strength < 0.4:
            return {"action": "fold", "amount": 0}
        elif hand_strength < 0.7:
            return {"action": "call", "amount": current_bet}
        else:
            raise_amount = min(current_bet * 2, player_chips)
            return {"action": "raise", "amount": raise_amount}
    
    else:  # hard
        # Advanced strategy with bluffing
        if hand_strength < 0.3 and secure_random.random() < 0.1:
            # Bluff
            return {"action": "raise", "amount": pot // 2, "strategy": "bluff"}
        elif hand_strength < 0.5:
            return {"action": "fold", "amount": 0}
        elif hand_strength < 0.8:
            return {"action": "call", "amount": current_bet}
        else:
            raise_amount = min(pot, player_chips)
            return {"action": "raise", "amount": raise_amount, "strategy": "value_bet"}

def evaluate_poker_hand_strength(hand: List, community: List) -> float:
    """Simplified hand strength evaluation (0.0 - 1.0)"""
    # This is a basic implementation
    # Full poker hand evaluation would check for straights, flushes, etc.
    all_cards = hand + community
    
    # Count high cards
    high_cards = sum(1 for card in all_cards if card.get('value', 0) >= 10)
    
    # Check for pairs
    values = [card.get('value') for card in all_cards]
    pairs = len(set([v for v in values if values.count(v) >= 2]))
    
    strength = (high_cards * 0.1) + (pairs * 0.3)
    return min(strength, 1.0)

# ========== ROCK PAPER SCISSORS AI ==========

def calculate_rps_move(game_state: Dict, difficulty: str, player_history: Optional[List]) -> Dict:
    """Rock Paper Scissors with pattern recognition"""
    choices = ["rock", "paper", "scissors"]
    
    if difficulty == "easy":
        return {"choice": secure_random.choice(choices), "strategy": "random"}
    
    elif difficulty == "medium" and player_history:
        # Slight pattern recognition
        if len(player_history) >= 3:
            last_three = [h.get("player_choice") for h in player_history[-3:]]
            most_common = max(set(last_three), key=last_three.count)
            # Counter the most common
            counter = {"rock": "paper", "paper": "scissors", "scissors": "rock"}
            return {"choice": counter.get(most_common, secure_random.choice(choices)), "strategy": "counter"}
    
    elif difficulty == "hard" and player_history:
        # Advanced pattern recognition
        if len(player_history) >= 5:
            last_five = [h.get("player_choice") for h in player_history[-5:]]
            # Detect pattern
            most_common = max(set(last_five), key=last_five.count)
            counter = {"rock": "paper", "paper": "scissors", "scissors": "rock"}
            return {"choice": counter.get(most_common, secure_random.choice(choices)), "strategy": "pattern"}
    
    return {"choice": secure_random.choice(choices), "strategy": "random"}

# ========== CHECKERS AI ==========

def calculate_checkers_move(game_state: Dict, difficulty: str) -> Dict:
    """Checkers AI with piece evaluation"""
    available_moves = game_state.get("legal_moves", [])
    
    if not available_moves:
        return {"move": None, "strategy": "no_moves"}
    
    if difficulty == "easy":
        return {"move": secure_random.choice(available_moves), "strategy": "random"}
    
    # Evaluate moves
    def evaluate_move(move):
        score = 0
        if move.get("capture"):
            score += 10
        if move.get("becomes_king"):
            score += 5
        if move.get("to_row") > move.get("from_row"):
            score += 1  # Forward progress
        return score
    
    if difficulty == "medium":
        scores = [(move, evaluate_move(move) + 0 + secrets.randbelow(4)) for move in available_moves]
    else:  # hard
        scores = [(move, evaluate_move(move)) for move in available_moves]
    
    best_move = max(scores, key=lambda x: x[1])[0]
    return {"move": best_move, "strategy": "evaluated"}

# ========== BATTLESHIP AI ==========

def calculate_battleship_move(game_state: Dict, difficulty: str) -> Dict:
    """Battleship AI with hunt-target strategy"""
    board_size = game_state.get("board_size", 10)
    previous_hits = game_state.get("hits", [])
    previous_misses = game_state.get("misses", [])
    
    if difficulty == "easy":
        # Random shots
        while True:
            row = secure_random.randint(0, board_size - 1)
            col = secure_random.randint(0, board_size - 1)
            if (row, col) not in previous_hits and (row, col) not in previous_misses:
                return {"row": row, "col": col, "strategy": "random"}
    
    elif difficulty in ["medium", "hard"]:
        # Hunt-Target strategy
        if previous_hits:
            # Target mode - shoot adjacent to last hit
            last_hit = previous_hits[-1]
            adjacent = [
                (last_hit[0] + 1, last_hit[1]),
                (last_hit[0] - 1, last_hit[1]),
                (last_hit[0], last_hit[1] + 1),
                (last_hit[0], last_hit[1] - 1)
            ]
            valid_adjacent = [
                (r, c) for r, c in adjacent 
                if 0 <= r < board_size and 0 <= c < board_size 
                and (r, c) not in previous_hits and (r, c) not in previous_misses
            ]
            if valid_adjacent:
                target = secure_random.choice(valid_adjacent)
                return {"row": target[0], "col": target[1], "strategy": "target"}
        
        # Hunt mode - checkerboard pattern for hard
        if difficulty == "hard":
            for row in range(board_size):
                for col in range(board_size):
                    if (row + col) % 2 == 0 and (row, col) not in previous_hits and (row, col) not in previous_misses:
                        return {"row": row, "col": col, "strategy": "hunt_pattern"}
        
        # Random if no pattern available
        while True:
            row = secure_random.randint(0, board_size - 1)
            col = secure_random.randint(0, board_size - 1)
            if (row, col) not in previous_hits and (row, col) not in previous_misses:
                return {"row": row, "col": col, "strategy": "hunt_random"}

# ========== GENERIC AI ==========

def calculate_generic_move(game_state: Dict, difficulty: str) -> Dict:
    """Generic AI for other games"""
    available_moves = game_state.get("available_moves", [])
    
    if not available_moves:
        return {"move": None, "strategy": "no_moves"}
    
    if difficulty == "easy":
        return {"move": secure_random.choice(available_moves), "strategy": "random"}
    elif difficulty == "medium":
        # Slightly smarter - prefer moves with higher scores if provided
        if isinstance(available_moves[0], dict) and "score" in available_moves[0]:
            weighted = sorted(available_moves, key=lambda x: x.get("score", 0) + secure_random.random() * 0.3, reverse=True)
            return {"move": weighted[0], "strategy": "weighted"}
        return {"move": secure_random.choice(available_moves), "strategy": "random"}
    else:  # hard
        if isinstance(available_moves[0], dict) and "score" in available_moves[0]:
            best = max(available_moves, key=lambda x: x.get("score", 0))
            return {"move": best, "strategy": "optimal"}
        return {"move": secure_random.choice(available_moves), "strategy": "random"}

# ========== AI GAME SESSION ==========

@router.post("/start-session")
async def start_ai_session(request: AIGameStart) -> Dict[str, Any]:
    """Start a practice session with AI opponent"""
    try:
        db = get_database()
        
        session_id = f"ai_{request.game_type}_{10000 + secrets.randbelow(90000)}"
        
        session = {
            "session_id": session_id,
            "user_id": request.user_id,
            "game_type": request.game_type,
            "difficulty": request.difficulty,
            "ai_opponent": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "moves": [],
            "status": "active"
        }
        
        await db.ai_practice_sessions.insert_one(session)
        
        return {
            "success": True,
            "session_id": session_id,
            "message": f"AI opponent ({request.difficulty}) ready!"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats/{user_id}")
async def get_ai_practice_stats(user_id: str) -> Dict[str, Any]:
    """Get user's AI practice statistics"""
    try:
        db = get_database()
        
        sessions = await db.ai_practice_sessions.find(
            {"user_id": user_id},
            {"_id": 0}
        ).to_list(1000)
        
        stats = {
            "total_games": len(sessions),
            "by_difficulty": {},
            "by_game_type": {}
        }
        
        for session in sessions:
            diff = session.get("difficulty", "medium")
            game = session.get("game_type", "unknown")
            
            stats["by_difficulty"][diff] = stats["by_difficulty"].get(diff, 0) + 1
            stats["by_game_type"][game] = stats["by_game_type"].get(game, 0) + 1
        
        return {
            "success": True,
            "stats": stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from datetime import datetime, timezone
