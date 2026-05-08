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
    "tictactoe": {"name": "Tic-Tac-Toe", "emoji": "⭕", "description": "Classic 3x3 strategy game", "players": 2, "implemented": True},
    "connect4": {"name": "Connect 4", "emoji": "🔴", "description": "Connect 4 in a row", "players": 2, "implemented": True},
    "uno": {"name": "UNO", "emoji": "🎴", "description": "Match colors and numbers", "players": 2, "implemented": True},
    "go_fish": {"name": "Go Fish", "emoji": "🎣", "description": "Collect 4-of-a-kind books", "players": 2, "implemented": True},
    "crazy_eights": {"name": "Crazy Eights", "emoji": "8️⃣", "description": "Match suit or rank, 8s are wild", "players": 2, "implemented": True},
    "blackjack": {"name": "Blackjack", "emoji": "🃏", "description": "Get to 21 without busting", "players": 2, "implemented": True},
    # Other games (coming soon)
    "chess": {"name": "Chess", "emoji": "♟️", "description": "Classic strategy game", "players": 2, "implemented": False},
    "checkers": {"name": "Checkers", "emoji": "🟤", "description": "Classic board game", "players": 2, "implemented": False},
    "poker": {"name": "Poker", "emoji": "🃏", "description": "Texas Hold'em", "players": 2, "implemented": False},
    "spades": {"name": "Spades", "emoji": "♠️", "description": "Trick-taking card game", "players": 2, "implemented": False},
    "hearts": {"name": "Hearts", "emoji": "♥️", "description": "Avoid hearts", "players": 2, "implemented": False},
    "rummy": {"name": "Rummy", "emoji": "🎴", "description": "Form sets and runs", "players": 2, "implemented": False},
    "backgammon": {"name": "Backgammon", "emoji": "🎲", "description": "Race your pieces home", "players": 2, "implemented": False},
    "reversi": {"name": "Reversi", "emoji": "⚫", "description": "Flip opponent's pieces", "players": 2, "implemented": False},
    "ludo": {"name": "Ludo", "emoji": "🎲", "description": "Race to the finish", "players": 2, "implemented": False},
}


# ==================== GAME LOGIC ====================

def initialize_tictactoe():
    """Initialize Tic Tac Toe game state"""
    return {
        "board": [
            ["", "", ""],
            ["", "", ""],
            ["", "", ""]
        ]
    }


def initialize_connect4():
    """Initialize Connect 4 game state"""
    return {
        "board": [
            ["", "", "", "", "", "", ""],
            ["", "", "", "", "", "", ""],
            ["", "", "", "", "", "", ""],
            ["", "", "", "", "", "", ""],
            ["", "", "", "", "", "", ""],
            ["", "", "", "", "", "", ""]
        ]
    }


def initialize_uno():
    """Initialize UNO game state with full deck"""
    colors = ["R", "B", "G", "Y"]
    deck = []
    
    # Number cards (0-9) - 0 has 1 copy, 1-9 have 2 copies each per color
    for color in colors:
        deck.append(f"{color}0")
        for num in range(1, 10):
            deck.append(f"{color}{num}")
            deck.append(f"{color}{num}")
    
    # Special cards (Skip, Reverse, Draw 2) - 2 copies each per color
    specials = ["S", "R", "D2"]
    for color in colors:
        for special in specials:
            deck.append(f"{color}{special}")
            deck.append(f"{color}{special}")
    
    # Wild cards - 4 of each
    for _ in range(4):
        deck.append("W")
        deck.append("WD4")
    
    # Shuffle deck
    secure_random.shuffle(deck)
    
    return deck


def check_tictactoe_winner(board):
    """Check if there's a winner in Tic Tac Toe"""
    # Check rows
    for row in board:
        if row[0] == row[1] == row[2] != "":
            return row[0]
    
    # Check columns
    for col in range(3):
        if board[0][col] == board[1][col] == board[2][col] != "":
            return board[0][col]
    
    # Check diagonals
    if board[0][0] == board[1][1] == board[2][2] != "":
        return board[0][0]
    if board[0][2] == board[1][1] == board[2][0] != "":
        return board[0][2]
    
    # Check for draw
    if all(cell != "" for row in board for cell in row):
        return "draw"
    
    return None


def check_connect4_winner(board, last_row, last_col, player):
    """Check if there's a winner in Connect 4"""
    def count_direction(row, col, dr, dc):
        count = 0
        r, c = row + dr, col + dc
        while 0 <= r < 6 and 0 <= c < 7 and board[r][c] == player:
            count += 1
            r, c = r + dr, c + dc
        return count
    
    directions = [
        (0, 1),   # Horizontal
        (1, 0),   # Vertical
        (1, 1),   # Diagonal \
        (1, -1)   # Diagonal /
    ]
    
    for dr, dc in directions:
        count = 1
        count += count_direction(last_row, last_col, dr, dc)
        count += count_direction(last_row, last_col, -dr, -dc)
        
        if count >= 4:
            return player
    
    # Check for draw (top row full)
    if all(cell != "" for cell in board[0]):
        return "draw"
    
    return None


def can_play_uno_card(card, top_card, current_color):
    """Check if a UNO card can be played"""
    if card.startswith("W"):
        return True
    
    card_color = card[0]
    card_value = card[1:]
    
    top_color = current_color if current_color else top_card[0]
    top_value = top_card[1:]
    
    return card_color == top_color or card_value == top_value


def create_standard_deck():
    """Create a standard 52-card deck"""
    suits = ["H", "D", "C", "S"]  # Hearts, Diamonds, Clubs, Spades
    ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
    deck = [f"{rank}{suit}" for suit in suits for rank in ranks]
    secure_random.shuffle(deck)
    return deck


def initialize_go_fish():
    """Initialize Go Fish game state"""
    deck = create_standard_deck()
    return {
        "deck": deck[14:],  # Remaining deck after dealing
        "players": {
            "player1": {"hand": deck[:7], "books": []},  # First 7 cards
            "player2": {"hand": deck[7:14], "books": []}  # Next 7 cards
        }
    }


def initialize_crazy_eights():
    """Initialize Crazy Eights game state"""
    deck = create_standard_deck()
    return {
        "deck": deck[11:],  # Remaining deck
        "discard": [deck[10]],  # Top card
        "players": {
            "player1": {"hand": deck[:5], "card_count": 5},
            "player2": {"hand": deck[5:10], "card_count": 5}
        },
        "current_suit": None  # For when 8 is played
    }


def initialize_blackjack():
    """Initialize Blackjack game state"""
    deck = create_standard_deck()
    return {
        "deck": deck[4:],
        "player_hand": [deck[0], deck[2]],
        "dealer_hand": [deck[1], deck[3]],
        "player_stood": False,
        "dealer_stood": False
    }


def calculate_blackjack_value(hand):
    """Calculate hand value in Blackjack"""
    value = 0
    aces = 0
    
    for card in hand:
        rank = card[:-1]  # Remove suit
        if rank in ["J", "Q", "K"]:
            value += 10
        elif rank == "A":
            aces += 1
            value += 11
        else:
            value += int(rank)
    
    # Adjust for aces
    while value > 21 and aces > 0:
        value -= 10
        aces -= 1
    
    return value


def check_go_fish_books(hand):
    """Check for 4-of-a-kind in Go Fish"""
    ranks = {}
    for card in hand:
        rank = card[:-1]
        ranks[rank] = ranks.get(rank, 0) + 1
    
    books = [rank for rank, count in ranks.items() if count == 4]
    return books


def can_play_crazy_eights_card(card, top_card, current_suit):
    """Check if card can be played in Crazy Eights"""
    if card[:-1] == "8":  # 8 is wild
        return True
    
    card_rank = card[:-1]
    card_suit = card[-1]
    
    top_rank = top_card[:-1]
    top_suit = current_suit if current_suit else top_card[-1]
    
    return card_suit == top_suit or card_rank == top_rank


# ==================== ENDPOINTS ====================

@router.get("/list")
async def list_games() -> Dict[str, Any]:
    """Get list of all available games"""
    return {"games": GAME_TYPES}


@router.post("/start")
async def start_game(game_data: StartGame, request: Request) -> Dict[str, Any]:
    """Start a new game with a match"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    # Verify match
    match = await db.matches.find_one({
        "match_id": game_data.match_id,
        "both_ids": {"$in": [current_user.user_id]}
    }, {"_id": 0})
    
    if not match:
        raise HTTPException(status_code=404, detail="Match not found")
    
    # Get both users
    users = await db.users.find({
        "user_id": {"$in": match["both_ids"]}
    }, {"_id": 0, "user_id": 1, "name": 1, "picture": 1}).to_list(2)
    
    if len(users) != 2:
        raise HTTPException(status_code=400, detail="Both users must exist")
    
    # Randomize player order
    secure_random.shuffle(users)
    
    # Initialize game state based on game type
    game_id = f"game_{uuid.uuid4().hex[:12]}"
    
    if game_data.game_type == "tictactoe":
        state = initialize_tictactoe()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "X"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "O"}
        ]
    
    elif game_data.game_type == "connect4":
        state = initialize_connect4()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "red"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "yellow"}
        ]
    
    elif game_data.game_type == "uno":
        deck = initialize_uno()
        
        # Deal 7 cards to each player
        player1_hand = [deck.pop() for _ in range(7)]
        player2_hand = [deck.pop() for _ in range(7)]
        
        # Flip first card (make sure it's not a wild)
        discard = deck.pop()
        while discard.startswith("W"):
            deck.insert(0, discard)
            discard = deck.pop()
        
        state = {
            "deck": deck,
            "discard": [discard],
            "players": {
                users[0]["user_id"]: {"hand": player1_hand, "card_count": 7},
                users[1]["user_id"]: {"hand": player2_hand, "card_count": 7}
            },
            "current_color": None,
            "direction": 1
        }
        
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "player1"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "player2"}
        ]
    
    elif game_data.game_type == "go_fish":
        state = initialize_go_fish()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "player1"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "player2"}
        ]
        # Map player IDs to player1/player2 in state
        state["players"][users[0]["user_id"]] = state["players"].pop("player1")
        state["players"][users[1]["user_id"]] = state["players"].pop("player2")
    
    elif game_data.game_type == "crazy_eights":
        state = initialize_crazy_eights()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "player1"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "player2"}
        ]
        # Map player IDs to player1/player2 in state
        state["players"][users[0]["user_id"]] = state["players"].pop("player1")
        state["players"][users[1]["user_id"]] = state["players"].pop("player2")
    
    elif game_data.game_type == "blackjack":
        state = initialize_blackjack()
        players = [
            {"user_id": users[0]["user_id"], "name": users[0]["name"], "role": "player"},
            {"user_id": users[1]["user_id"], "name": users[1]["name"], "role": "dealer"}
        ]
    
    else:
        raise HTTPException(status_code=400, detail="Game type not implemented yet")
    
    # Create game document
    game = {
        "game_id": game_id,
        "game_type": game_data.game_type,
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
    
    return {
        "game_id": game_id,
        "message": f"{game_data.game_type} game started",
        "game": game
    }


@router.get("/{game_id}")
async def get_game(game_id: str, request: Request) -> Dict[str, Any]:
    """Get current game state"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Verify user is a player
    player_ids = [p["user_id"] for p in game["players"]]
    if current_user.user_id not in player_ids:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # For UNO, hide opponent's hand
    if game["game_type"] == "uno":
        opponent_id = [pid for pid in player_ids if pid != current_user.user_id][0]
        if opponent_id in game["state"]["players"]:
            game["state"]["players"][opponent_id]["hand"] = "hidden"
    
    return game


@router.post("/{game_id}/move")
async def make_move(game_id: str, move: GameMove, request: Request) -> Dict[str, Any]:
    """Make a move in the game"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Check if it's player's turn
    if game["current_turn"] != current_user.user_id:
        raise HTTPException(status_code=400, detail="Not your turn")
    
    # Check if game is still in progress
    if game["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Game is not in progress")
    
    # Process move based on game type
    game_type = game["game_type"]
    state = game["state"]
    players = game["players"]
    
    if game_type == "tictactoe":
        row = move.move_data.get("row")
        col = move.move_data.get("col")
        
        if row is None or col is None or row < 0 or row > 2 or col < 0 or col > 2:
            raise HTTPException(status_code=400, detail="Invalid move")
        
        # Check if cell is empty
        if state["board"][row][col] != "":
            raise HTTPException(status_code=400, detail="Cell already occupied")
        
        # Get player's role (X or O)
        player_role = next(p["role"] for p in players if p["user_id"] == current_user.user_id)
        
        # Make move
        state["board"][row][col] = player_role
        
        # Check for winner
        winner = check_tictactoe_winner(state["board"])
        
        if winner:
            if winner == "draw":
                game["status"] = "completed"
                game["winner"] = "draw"
            else:
                game["status"] = "completed"
                game["winner"] = next(p["user_id"] for p in players if p["role"] == winner)
        else:
            # Switch turn
            game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
    
    elif game_type == "connect4":
        col = move.move_data.get("col")
        
        if col is None or col < 0 or col > 6:
            raise HTTPException(status_code=400, detail="Invalid column")
        
        # Find lowest empty row (gravity)
        row = None
        for r in range(5, -1, -1):
            if state["board"][r][col] == "":
                row = r
                break
        
        if row is None:
            raise HTTPException(status_code=400, detail="Column is full")
        
        # Get player's role (red or yellow)
        player_role = next(p["role"] for p in players if p["user_id"] == current_user.user_id)
        
        # Make move
        state["board"][row][col] = player_role
        
        # Check for winner
        winner = check_connect4_winner(state["board"], row, col, player_role)
        
        if winner:
            if winner == "draw":
                game["status"] = "completed"
                game["winner"] = "draw"
            else:
                game["status"] = "completed"
                game["winner"] = next(p["user_id"] for p in players if p["role"] == winner)
        else:
            # Switch turn
            game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
    
    elif game_type == "uno":
        action = move.move_data.get("action")  # "play" or "draw"
        
        if action == "draw":
            # Draw a card
            if not state["deck"]:
                # Reshuffle discard pile into deck
                top_card = state["discard"].pop()
                state["deck"] = state["discard"]
                state["discard"] = [top_card]
                secure_random.shuffle(state["deck"])
            
            card = state["deck"].pop()
            state["players"][current_user.user_id]["hand"].append(card)
            state["players"][current_user.user_id]["card_count"] += 1
            
            # Player can either play the drawn card or end turn
            # For simplicity, we'll end their turn after drawing
            game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
        
        elif action == "play":
            card = move.move_data.get("card")
            wild_color = move.move_data.get("wild_color")  # If playing wild card
            
            if not card:
                raise HTTPException(status_code=400, detail="No card specified")
            
            # Check if player has the card
            player_hand = state["players"][current_user.user_id]["hand"]
            if card not in player_hand:
                raise HTTPException(status_code=400, detail="You don't have that card")
            
            # Check if card can be played
            top_card = state["discard"][-1]
            current_color = state["current_color"]
            
            if not can_play_uno_card(card, top_card, current_color):
                raise HTTPException(status_code=400, detail="Cannot play that card")
            
            # Remove card from hand
            player_hand.remove(card)
            state["players"][current_user.user_id]["card_count"] -= 1
            
            # Add to discard pile
            state["discard"].append(card)
            
            # Check for win
            if len(player_hand) == 0:
                game["status"] = "completed"
                game["winner"] = current_user.user_id
            else:
                # Handle special cards
                if card.startswith("W"):
                    # Wild card
                    if wild_color and wild_color in ["R", "B", "G", "Y"]:
                        state["current_color"] = wild_color
                    else:
                        raise HTTPException(status_code=400, detail="Must specify color for wild card")
                    
                    if card == "WD4":
                        # Opponent draws 4 cards
                        opponent_id = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
                        for _ in range(4):
                            if state["deck"]:
                                drawn_card = state["deck"].pop()
                                state["players"][opponent_id]["hand"].append(drawn_card)
                                state["players"][opponent_id]["card_count"] += 1
                else:
                    state["current_color"] = None
                    
                    # Handle other special cards
                    if card.endswith("S"):
                        # Skip - opponent loses turn, so current player goes again
                        pass
                    elif card.endswith("R"):
                        # Reverse - in 2-player game, same as skip
                        pass
                    elif card.endswith("D2"):
                        # Draw 2
                        opponent_id = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
                        for _ in range(2):
                            if state["deck"]:
                                drawn_card = state["deck"].pop()
                                state["players"][opponent_id]["hand"].append(drawn_card)
                                state["players"][opponent_id]["card_count"] += 1
                
                # Switch turn (unless skip/reverse was played)
                if not (card.endswith("S") or card.endswith("R") or card.endswith("D2") or card.startswith("W")):
                    game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
                else:
                    # Skip opponent's turn
                    game["current_turn"] = next(p["user_id"] for p in players if p["user_id"] != current_user.user_id)
        else:
            raise HTTPException(status_code=400, detail="Invalid action")
    
    else:
        raise HTTPException(status_code=400, detail="Game type not implemented")
    
    # Update game
    game["state"] = state
    game["last_move_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.games.update_one(
        {"game_id": game_id},
        {"$set": game}
    )
    
    return {
        "message": "Move made successfully",
        "game": game
    }


@router.post("/{game_id}/quit")
async def quit_game(game_id: str, request: Request) -> Dict[str, Any]:
    """Forfeit the game"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Verify user is a player
    player_ids = [p["user_id"] for p in game["players"]]
    if current_user.user_id not in player_ids:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Set opponent as winner
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
    """Get user's active games"""
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
    """Get user's completed games"""
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    db = get_database()
    
    games = await db.games.find({
        "players.user_id": current_user.user_id,
        "status": "completed"
    }, {"_id": 0}).sort("last_move_at", -1).to_list(50)
    
    return {"games": games}
