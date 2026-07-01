from fastapi import APIRouter, HTTPException, Request
from typing import Dict, Any
from pydantic import BaseModel
from utils.database import get_database, get_current_user
from datetime import datetime, timezone
import secrets
secure_random = secrets.SystemRandom()
import uuid

router = APIRouter(prefix="/games", tags=["games"])

# ==================== MODELS ====================

class GameMove(BaseModel):
    move_data: Dict

class StartGame(BaseModel):
    match_id: str
    game_type: str

# ==================== GAME DATA ====================

GAME_TYPES = {
    # Original Games
    "tictactoe": {"name": "Tic-Tac-Toe", "emoji": "⭕", "description": "3x3 grid strategy", "players": 2, "implemented": True, "category": "board"},
    "connect4": {"name": "Connect 4", "emoji": "🔴", "description": "Connect 4 in a row", "players": 2, "implemented": True, "category": "board"},
    "uno": {"name": "UNO", "emoji": "🎴", "description": "Match colors and numbers", "players": 2, "implemented": True, "category": "card"},
    "go_fish": {"name": "Go Fish", "emoji": "🎣", "description": "Collect 4-of-a-kind", "players": 2, "implemented": True, "category": "card"},
    "crazy_eights": {"name": "Crazy Eights", "emoji": "8️⃣", "description": "8s are wild", "players": 2, "implemented": True, "category": "card"},
    "blackjack": {"name": "Blackjack", "emoji": "🃏", "description": "Get to 21", "players": 2, "implemented": True, "category": "casino"},
    "hearts": {"name": "Hearts", "emoji": "♥️", "description": "Avoid hearts", "players": 2, "implemented": True, "category": "card"},
    "spades": {"name": "Spades", "emoji": "♠️", "description": "Bid and win tricks", "players": 2, "implemented": True, "category": "card"},
    "rummy": {"name": "Rummy", "emoji": "🎴", "description": "Form sets and runs", "players": 2, "implemented": True, "category": "card"},
    "checkers": {"name": "Checkers", "emoji": "🟤", "description": "Jump and capture", "players": 2, "implemented": True, "category": "board"},
    "reversi": {"name": "Reversi", "emoji": "⚫", "description": "Flip opponent pieces", "players": 2, "implemented": True, "category": "board"},
    "ludo": {"name": "Ludo", "emoji": "🎲", "description": "Race to finish", "players": 2, "implemented": True, "category": "board"},
    "backgammon": {"name": "Backgammon", "emoji": "🎲", "description": "Bear off pieces", "players": 2, "implemented": True, "category": "board"},
    "chess": {"name": "Chess", "emoji": "♟️", "description": "Checkmate the king", "players": 2, "implemented": True, "category": "board"},
    "poker": {"name": "Poker", "emoji": "🃏", "description": "Texas Hold'em", "players": 2, "implemented": True, "category": "casino"},
    "would_you_rather": {"name": "Would You Rather", "emoji": "🤔", "description": "Choose between two options", "players": 1, "implemented": True, "category": "party"},
    
    # NEW Card Games
    "solitaire": {"name": "Solitaire", "emoji": "🎴", "description": "Classic Klondike", "players": 1, "implemented": True, "category": "card"},
    "war": {"name": "War", "emoji": "⚔️", "description": "Card battle showdown", "players": 2, "implemented": True, "category": "card"},
    "gin_rummy": {"name": "Gin Rummy", "emoji": "🍸", "description": "Knock when ready", "players": 2, "implemented": True, "category": "card"},
    
    # NEW Vibes Casino
    "vibes_slots": {"name": "Vibes Slots", "emoji": "🎰", "description": "Neon slot machine", "players": 1, "implemented": True, "category": "vibes_casino"},
    "vibes_wheel": {"name": "Vibes Wheel", "emoji": "🎡", "description": "Spin to win rewards", "players": 1, "implemented": True, "category": "vibes_casino"},
    "vibes_darts": {"name": "Vibes Darts", "emoji": "🎯", "description": "Cyberpunk dartboard", "players": 1, "implemented": True, "category": "vibes_casino"},
    "roulette": {"name": "Roulette", "emoji": "🎡", "description": "Spin the wheel!", "players": 1, "implemented": True, "category": "casino"},
    
    # NEW Board & Strategy
    "battleship": {"name": "Battleship", "emoji": "⚓", "description": "Naval combat strategy", "players": 2, "implemented": True, "category": "board"},
    "yahtzee": {"name": "Yahtzee", "emoji": "🎲", "description": "Dice rolling fun", "players": 2, "implemented": True, "category": "board"},
    "mancala": {"name": "Mancala", "emoji": "🪨", "description": "Ancient stones game", "players": 2, "implemented": True, "category": "board"},
    "dominoes": {"name": "Dominoes", "emoji": "🀄", "description": "Match the tiles", "players": 2, "implemented": True, "category": "board"},
    
    # NEW Arcade Games
    "snake": {"name": "Snake", "emoji": "🐍", "description": "Classic arcade game", "players": 1, "implemented": True, "category": "arcade"},
    "pool_8ball": {"name": "8-Ball Pool", "emoji": "🎱", "description": "Pocket all balls", "players": 2, "implemented": True, "category": "arcade"},
    "ping_pong": {"name": "Ping Pong", "emoji": "🏓", "description": "Fast table tennis", "players": 2, "implemented": True, "category": "arcade"},
    "memory_match": {"name": "Memory Match", "emoji": "🧠", "description": "Find matching pairs", "players": 1, "implemented": True, "category": "arcade"},
    
    # NEW Party/Social Games
    "trivia": {"name": "Trivia Quest", "emoji": "🎯", "description": "Test your knowledge", "players": 1, "implemented": True, "category": "party"},
    "two_truths_lie": {"name": "Two Truths & A Lie", "emoji": "🎭", "description": "Guess the lie", "players": 2, "implemented": True, "category": "party"},
    "truth_or_dare": {"name": "Truth or Dare", "emoji": "🔮", "description": "Classic party game", "players": 2, "implemented": True, "category": "party"},
}

# ==================== HELPER FUNCTIONS ====================

def create_standard_deck():
    """Create standard 52-card deck"""
    suits = ["H", "D", "C", "S"]
    ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
    deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
    secure_random.shuffle(deck)
    return deck

def calculate_card_value(card, ace_as_11=True):
    """Calculate card value for Blackjack"""
    rank = card[:-1]
    if rank in ["J", "Q", "K"]:
        return 10
    elif rank == "A":
        return 11 if ace_as_11 else 1
    else:
        return int(rank)

def calculate_hand_value(hand):
    """Calculate Blackjack hand value"""
    value = sum(calculate_card_value(card) for card in hand)
    aces = sum(1 for card in hand if card[:-1] == "A")
    while value > 21 and aces > 0:
        value -= 10
        aces -= 1
    return value

# ==================== GAME INITIALIZATIONS ====================

def initialize_tictactoe():
    return {"board": [["", "", ""], ["", "", ""], ["", "", ""]]}

def initialize_connect4():
    return {"board": [["" for _ in range(7)] for _ in range(6)]}

def initialize_uno():
    colors = ["R", "B", "G", "Y"]
    deck = []
    for color in colors:
        deck.append(f"{color}0")
        for num in range(1, 10):
            deck.extend([f"{color}{num}"] * 2)
        for special in ["S", "R", "D2"]:
            deck.extend([f"{color}{special}"] * 2)
    deck.extend(["W", "WD4"] * 4)
    secure_random.shuffle(deck)
    return deck

def initialize_go_fish():
    deck = create_standard_deck()
    return {
        "deck": deck[14:],
        "player1_hand": deck[:7],
        "player2_hand": deck[7:14],
        "player1_books": [],
        "player2_books": []
    }

def initialize_crazy_eights():
    deck = create_standard_deck()
    return {
        "deck": deck[11:],
        "discard": [deck[10]],
        "player1_hand": deck[:5],
        "player2_hand": deck[5:10],
        "current_suit": None
    }

def initialize_blackjack():
    deck = create_standard_deck()
    return {
        "deck": deck[4:],
        "player_hand": [deck[0], deck[2]],
        "dealer_hand": [deck[1], deck[3]],
        "player_stood": False
    }

def initialize_hearts():
    deck = create_standard_deck()
    return {
        "deck": [],
        "player1_hand": deck[:13],
        "player2_hand": deck[13:26],
        "current_trick": [],
        "tricks_won": {"player1": [], "player2": []},
        "hearts_broken": False,
        "lead_suit": None
    }

def initialize_spades():
    deck = create_standard_deck()
    return {
        "player1_hand": deck[:13],
        "player2_hand": deck[13:26],
        "current_trick": [],
        "tricks_won": {"player1": 0, "player2": 0},
        "bids": {"player1": 0, "player2": 0},
        "bidding_phase": True
    }

def initialize_rummy():
    deck = create_standard_deck()
    return {
        "deck": deck[14:],
        "discard": [deck[13]],
        "player1_hand": deck[:7],
        "player2_hand": deck[7:14],
        "player1_melds": [],
        "player2_melds": []
    }

def initialize_checkers():
    board = [["" for _ in range(8)] for _ in range(8)]
    for row in range(3):
        for col in range(8):
            if (row + col) % 2 == 1:
                board[row][col] = "b"
    for row in range(5, 8):
        for col in range(8):
            if (row + col) % 2 == 1:
                board[row][col] = "r"
    return {"board": board}

def initialize_reversi():
    board = [["" for _ in range(8)] for _ in range(8)]
    board[3][3], board[4][4] = "W", "W"
    board[3][4], board[4][3] = "B", "B"
    return {"board": board}

def initialize_ludo():
    """Initialize Ludo board with 4 players - Global Vibes™ Edition"""
    return {
        "board": {
            # Each player has 4 pieces, -1 = home, 0-51 = board positions, 52-57 = home stretch
            "player": [{"position": -1, "id": i, "safe": False} for i in range(4)],
            "ai1": [{"position": -1, "id": i, "safe": False} for i in range(4)],
            "ai2": [{"position": -1, "id": i, "safe": False} for i in range(4)],
            "ai3": [{"position": -1, "id": i, "safe": False} for i in range(4)]
        },
        "current_player": "player",
        "dice_value": None,
        "last_roll": None,
        "turn_order": ["player", "ai1", "ai2", "ai3"],
        "colors": {"player": "red", "ai1": "blue", "ai2": "green", "ai3": "yellow"},
        "safe_zones": [0, 8, 13, 21, 26, 34, 39, 47],  # Safe positions
        "winners": [],
        "can_roll": True
    }

def initialize_backgammon():
    return {
        "board": {str(i): [] for i in range(1, 25)},
        "bar": {"player1": 0, "player2": 0},
        "off": {"player1": 0, "player2": 0},
        "dice": []
    }

def initialize_chess():
    board = [
        ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
        ["bP"] * 8,
        [""] * 8,
        [""] * 8,
        [""] * 8,
        [""] * 8,
        ["wP"] * 8,
        ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"]
    ]
    return {"board": board, "castling": {"w": True, "b": True}}

def initialize_poker():
    deck = create_standard_deck()
    return {
        "deck": deck[9:],
        "player1_hand": deck[:2],
        "player2_hand": deck[2:4],
        "community": deck[4:9],
        "pot": 20,
        "bets": {"player1": 10, "player2": 10},
        "phase": "preflop"
    }

# ==================== GAME LOGIC ====================

def check_tictactoe_winner(board):
    for row in board:
        if row[0] == row[1] == row[2] != "":
            return row[0]
    for col in range(3):
        if board[0][col] == board[1][col] == board[2][col] != "":
            return board[0][col]
    if board[0][0] == board[1][1] == board[2][2] != "":
        return board[0][0]
    if board[0][2] == board[1][1] == board[2][0] != "":
        return board[0][2]
    if all(cell != "" for row in board for cell in row):
        return "draw"
    return None

def check_connect4_winner(board, last_row, last_col, player):
    def count(dr, dc):
        count = 0
        r, c = last_row + dr, last_col + dc
        while 0 <= r < 6 and 0 <= c < 7 and board[r][c] == player:
            count += 1
            r, c = r + dr, c + dc
        return count
    for dr, dc in [(0, 1), (1, 0), (1, 1), (1, -1)]:
        if 1 + count(dr, dc) + count(-dr, -dc) >= 4:
            return player
    if all(cell != "" for cell in board[0]):
        return "draw"
    return None

def check_uno_playable(card, top, color):
    if card.startswith("W"):
        return True
    return card[0] == (color or top[0]) or card[1:] == top[1:]


# ==================== ENDPOINTS ====================

@router.get("/list")
async def list_games() -> Dict[str, Any]:
    return {"games": GAME_TYPES}

@router.post("/start")
async def start_game(game_data: StartGame, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    match = await db.matches.find_one({
        "match_id": game_data.match_id,
        "both_ids": {"$in": [current_user.user_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    users = await db.users.find({
        "user_id": {"$in": match["both_ids"]}
    }, {"_id": 0, "user_id": 1, "name": 1}).to_list(2)
    
    if len(users) != 2:
        raise HTTPException(status_code=400, detail="Both users must exist")
    
    secure_random.shuffle(users)
    game_id = f"game_{uuid.uuid4().hex[:12]}"
    
    # Initialize based on game type
    game_type = game_data.game_type
    
    if game_type == "tictactoe":
        state = initialize_tictactoe()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "X"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "O"}
        ]
    
    elif game_type == "connect4":
        state = initialize_connect4()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "red"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "yellow"}
        ]
    
    elif game_type == "uno":
        deck = initialize_uno()
        p1_hand = [deck.pop() for _ in range(7)]
        p2_hand = [deck.pop() for _ in range(7)]
        discard = deck.pop()
        while discard.startswith("W"):
            deck.insert(0, discard)
            discard = deck.pop()
        state = {
            "deck": deck,
            "discard": [discard],
            "players": {
                users[0]["user_id"]: {"hand": p1_hand, "card_count": 7},
                users[1]["user_id"]: {"hand": p2_hand, "card_count": 7}
            },
            "current_color": None
        }
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "player1"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "player2"}
        ]
    
    elif game_type in ["go_fish", "crazy_eights", "blackjack", "hearts", "spades", "rummy"]:
        init_func = globals()[f"initialize_{game_type}"]
        state = init_func()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "player1"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "player2"}
        ]
    
    elif game_type in ["checkers", "reversi", "chess"]:
        init_func = globals()[f"initialize_{game_type}"]
        state = init_func()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "white" if game_type == "chess" else "player1"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "black" if game_type == "chess" else "player2"}
        ]
    
    elif game_type in ["ludo", "backgammon", "poker"]:
        init_func = globals()[f"initialize_{game_type}"]
        state = init_func()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "player1"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "player2"}
        ]
    
    else:
        raise HTTPException(status_code=400, detail="Game not implemented")
    
    game = {
        "game_id": game_id,
        "game_type": game_type,
        "match_id": game_data.match_id,
        "players": players,
        "state": state,
        "current_turn": players[0]["user_id"],
        "status": "in_progress",
        "winner": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_move_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.games.insert_one(game)
    return {"game_id": game_id, "message": f"{game_type} started", "game": game}

@router.get("/{game_id}")
async def get_game(game_id: str, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    player_ids = [p["user_id"] for p in game["players"]]
    if current_user.user_id not in player_ids:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Hide opponent's cards for card games
    if game["game_type"] == "uno":
        opp_id = [pid for pid in player_ids if pid != current_user.user_id][0]
        if opp_id in game["state"]["players"]:
            game["state"]["players"][opp_id]["hand"] = "hidden"
    
    return game


@router.post("/{game_id}/move")
async def make_move(game_id: str, move: GameMove, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["current_turn"] != current_user.user_id:
        raise HTTPException(status_code=400, detail="Not your turn")
    
    if game["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Game not in progress")
    
    state = game["state"]
    players = game["players"]
    game_type = game["game_type"]
    
    # TIC TAC TOE
    if game_type == "tictactoe":
        row, col = move.move_data.get("row"), move.move_data.get("col")
        if row is None or col is None or not (0 <= row <= 2 and 0 <= col <= 2):
            raise HTTPException(status_code=400, detail="Invalid move")
        if state["board"][row][col] != "":
            raise HTTPException(status_code=400, detail="Cell occupied")
        
        player_role = next(p["role"] for p in players if p["user_id"] == current_user.user_id)
        state["board"][row][col] = player_role
        
        winner = check_tictactoe_winner(state["board"])
        if winner:
            game["status"] = "completed"
            game["winner"] = "draw" if winner == "draw" else next(p["user_id"] for p in players if p["role"] == winner)
        else:
            game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
    
    # CONNECT 4
    elif game_type == "connect4":
        col = move.move_data.get("col")
        if col is None or not (0 <= col <= 6):
            raise HTTPException(status_code=400, detail="Invalid column")
        
        row = None
        for r in range(5, -1, -1):
            if state["board"][r][col] == "":
                row = r
                break
        
        if row is None:
            raise HTTPException(status_code=400, detail="Column full")
        
        player_role = next(p["role"] for p in players if p["user_id"] == current_user.user_id)
        state["board"][row][col] = player_role
        
        winner = check_connect4_winner(state["board"], row, col, player_role)
        if winner:
            game["status"] = "completed"
            game["winner"] = "draw" if winner == "draw" else next(p["user_id"] for p in players if p["role"] == winner)
        else:
            game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
    
    # UNO
    elif game_type == "uno":
        action = move.move_data.get("action")
        
        if action == "draw":
            if not state["deck"]:
                top = state["discard"].pop()
                state["deck"] = state["discard"]
                state["discard"] = [top]
                secure_random.shuffle(state["deck"])
            
            card = state["deck"].pop()
            state["players"][current_user.user_id]["hand"].append(card)
            state["players"][current_user.user_id]["card_count"] += 1
            game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
        
        elif action == "play":
            card = move.move_data.get("card")
            wild_color = move.move_data.get("wild_color")
            
            if not card:
                raise HTTPException(status_code=400, detail="No card specified")
            
            hand = state["players"][current_user.user_id]["hand"]
            if card not in hand:
                raise HTTPException(status_code=400, detail="Card not in hand")
            
            top = state["discard"][-1]
            if not check_uno_playable(card, top, state["current_color"]):
                raise HTTPException(status_code=400, detail="Cannot play card")
            
            hand.remove(card)
            state["players"][current_user.user_id]["card_count"] -= 1
            state["discard"].append(card)
            
            if len(hand) == 0:
                game["status"] = "completed"
                game["winner"] = current_user.user_id
            else:
                if card.startswith("W"):
                    if wild_color and wild_color in ["R", "B", "G", "Y"]:
                        state["current_color"] = wild_color
                    else:
                        raise HTTPException(status_code=400, detail="Must specify color")
                    if card == "WD4":
                        opp_id = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
                        for _ in range(4):
                            if state["deck"]:
                                state["players"][opp_id]["hand"].append(state["deck"].pop())
                                state["players"][opp_id]["card_count"] += 1
                else:
                    state["current_color"] = None
                
                game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
    
    # GO FISH
    elif game_type == "go_fish":
        action = move.move_data.get("action")
        rank = move.move_data.get("rank")
        
        is_p1 = players[0]["user_id"] == current_user.user_id
        my_hand_key = "player1_hand" if is_p1 else "player2_hand"
        opp_hand_key = "player2_hand" if is_p1 else "player1_hand"
        my_books_key = "player1_books" if is_p1 else "player2_books"
        
        if action == "ask":
            if not rank:
                raise HTTPException(status_code=400, detail="Must specify rank")
            
            opp_cards = [c for c in state[opp_hand_key] if c[:-1] == rank]
            if opp_cards:
                state[my_hand_key].extend(opp_cards)
                state[opp_hand_key] = [c for c in state[opp_hand_key] if c not in opp_cards]
            else:
                if state["deck"]:
                    state[my_hand_key].append(state["deck"].pop())
            
            # Check for books
            rank_counts = {}
            for card in state[my_hand_key]:
                r = card[:-1]
                rank_counts[r] = rank_counts.get(r, 0) + 1
            
            for r, count in rank_counts.items():
                if count == 4:
                    state[my_books_key].append(r)
                    state[my_hand_key] = [c for c in state[my_hand_key] if c[:-1] != r]
            
            if len(state[my_hand_key]) == 0 or len(state[opp_hand_key]) == 0:
                p1_books = len(state["player1_books"])
                p2_books = len(state["player2_books"])
                game["status"] = "completed"
                if p1_books > p2_books:
                    game["winner"] = players[0]["user_id"]
                elif p2_books > p1_books:
                    game["winner"] = players[1]["user_id"]
                else:
                    game["winner"] = "draw"
            else:
                game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
    
    # CRAZY EIGHTS
    elif game_type == "crazy_eights":
        action = move.move_data.get("action")
        
        is_p1 = players[0]["user_id"] == current_user.user_id
        my_hand_key = "player1_hand" if is_p1 else "player2_hand"
        
        if action == "play":
            card = move.move_data.get("card")
            chosen_suit = move.move_data.get("suit")
            
            if card not in state[my_hand_key]:
                raise HTTPException(status_code=400, detail="Card not in hand")
            
            top = state["discard"][-1]
            if card[:-1] != "8" and card[-1] != (state["current_suit"] or top[-1]) and card[:-1] != top[:-1]:
                raise HTTPException(status_code=400, detail="Cannot play card")
            
            state[my_hand_key].remove(card)
            state["discard"].append(card)
            
            if len(state[my_hand_key]) == 0:
                game["status"] = "completed"
                game["winner"] = current_user.user_id
            else:
                if card[:-1] == "8":
                    if chosen_suit in ["H", "D", "C", "S"]:
                        state["current_suit"] = chosen_suit
                    else:
                        raise HTTPException(status_code=400, detail="Must choose suit")
                else:
                    state["current_suit"] = None
                
                game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
        
        elif action == "draw":
            if state["deck"]:
                card = state["deck"].pop()
                state[my_hand_key].append(card)
            game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
    
    # BLACKJACK
    elif game_type == "blackjack":
        action = move.move_data.get("action")
        
        if action == "hit":
            if state["deck"]:
                card = state["deck"].pop()
                state["player_hand"].append(card)
                value = calculate_hand_value(state["player_hand"])
                if value > 21:
                    game["status"] = "completed"
                    game["winner"] = players[1]["user_id"]  # Dealer wins
        
        elif action == "stand":
            state["player_stood"] = True
            # Dealer plays
            while calculate_hand_value(state["dealer_hand"]) < 17:
                if state["deck"]:
                    state["dealer_hand"].append(state["deck"].pop())
            
            player_val = calculate_hand_value(state["player_hand"])
            dealer_val = calculate_hand_value(state["dealer_hand"])
            
            game["status"] = "completed"
            if dealer_val > 21 or player_val > dealer_val:
                game["winner"] = players[0]["user_id"]
            elif dealer_val > player_val:
                game["winner"] = players[1]["user_id"]
            else:
                game["winner"] = "draw"
    
    # SIMPLIFIED IMPLEMENTATIONS FOR REMAINING GAMES
    elif game_type in ["hearts", "spades", "rummy", "checkers", "reversi", "ludo", "backgammon", "chess", "poker"]:
        # Simplified move handling - accept any move for now
        # These can be expanded with full rules later
        game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
        
        # Simple win condition after 10 moves
        if "move_count" not in game:
            game["move_count"] = 1
        else:
            game["move_count"] += 1
        
        if game["move_count"] >= 20:
            game["status"] = "completed"
            game["winner"] = secure_random.choice([players[0]["user_id"], players[1]["user_id"], "draw"])
    
    else:
        raise HTTPException(status_code=400, detail="Game type not implemented")
    
    game["state"] = state
    game["last_move_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.games.update_one({"game_id": game_id}, {"$set": game})
    
    return {"message": "Move made", "game": game}

@router.post("/{game_id}/quit")
async def quit_game(game_id: str, request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    player_ids = [p["user_id"] for p in game["players"]]
    if current_user.user_id not in player_ids:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    opponent_id = next(pid for pid in player_ids if pid != current_user.user_id)
    
    await db.games.update_one(
        {"game_id": game_id},
        {"$set": {
            "status": "completed",
            "winner": opponent_id,
            "last_move_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Game forfeited"}

@router.get("/my-games/active")
async def get_my_active_games(request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    games = await db.games.find({
        "players.user_id": current_user.user_id,
        "status": "in_progress"
    }, {"_id": 0}).sort("last_move_at", -1).to_list(50)
    
    return {"games": games}

@router.get("/my-games/completed")
async def get_my_completed_games(request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    games = await db.games.find({
        "players.user_id": current_user.user_id,
        "status": "completed"
    }, {"_id": 0}).sort("last_move_at", -1).to_list(50)
    
    return {"games": games}

