"""
AI Engine for Global Vibes Games
Provides AI opponents for solo/practice mode across all game types
"""

import secrets
secure_random = secrets.SystemRandom()
from typing import List, Dict, Optional, Tuple

# ==================== BASE AI CLASS ====================

class GameAI:
    """Base class for game AI with difficulty levels"""
    
    def __init__(self, difficulty: str = "medium"):
        self.difficulty = difficulty  # easy, medium, hard
        
    def get_move(self, game_state: Dict, game_type: str) -> Dict:
        """Get AI move based on game type"""
        ai_methods = {
            "tictactoe": self.tictactoe_move,
            "connect4": self.connect4_move,
            "checkers": self.checkers_move,
            "reversi": self.reversi_move,
            "chess": self.chess_move,
            "ludo": self.ludo_move,
            "backgammon": self.backgammon_move,
            "blackjack": self.blackjack_move,
            "uno": self.uno_move,
            "go_fish": self.go_fish_move,
            "crazy_eights": self.crazy_eights_move,
            "hearts": self.hearts_move,
            "spades": self.spades_move,
            "rummy": self.rummy_move,
            "poker": self.poker_move
        }
        
        method = ai_methods.get(game_type)
        if not method:
            raise ValueError(f"AI not implemented for {game_type}")
        
        return method(game_state)
    
    # ==================== TIC-TAC-TOE AI ====================
    
    def tictactoe_move(self, game_state: Dict) -> Dict:
        """Minimax algorithm for Tic-Tac-Toe"""
        board = game_state["board"]
        
        if self.difficulty == "easy":
            # Random valid move
            empty_cells = [(i, j) for i in range(3) for j in range(3) if board[i][j] == ""]
            if empty_cells:
                row, col = secure_random.choice(empty_cells)
                return {"row": row, "col": col}
        
        # Medium/Hard: Use minimax
        best_score = float('-inf')
        best_move = None
        
        for i in range(3):
            for j in range(3):
                if board[i][j] == "":
                    board[i][j] = "O"  # AI is O
                    score = self._minimax_tictactoe(board, 0, False)
                    board[i][j] = ""
                    if score > best_score:
                        best_score = score
                        best_move = (i, j)
        
        if best_move:
            return {"row": best_move[0], "col": best_move[1]}
        
        return {"row": 0, "col": 0}
    
    def _minimax_tictactoe(self, board: List, depth: int, is_maximizing: bool) -> int:
        """Minimax algorithm for tic-tac-toe"""
        winner = self._check_tictactoe_winner(board)
        if winner == "O":
            return 10 - depth
        if winner == "X":
            return depth - 10
        if self._is_board_full(board):
            return 0
        
        if is_maximizing:
            best_score = float('-inf')
            for i in range(3):
                for j in range(3):
                    if board[i][j] == "":
                        board[i][j] = "O"
                        score = self._minimax_tictactoe(board, depth + 1, False)
                        board[i][j] = ""
                        best_score = max(score, best_score)
            return best_score
        else:
            best_score = float('inf')
            for i in range(3):
                for j in range(3):
                    if board[i][j] == "":
                        board[i][j] = "X"
                        score = self._minimax_tictactoe(board, depth + 1, True)
                        board[i][j] = ""
                        best_score = min(score, best_score)
            return best_score
    
    def _check_tictactoe_winner(self, board: List) -> Optional[str]:
        """Check tic-tac-toe winner"""
        # Rows
        for row in board:
            if row[0] == row[1] == row[2] != "":
                return row[0]
        # Columns
        for col in range(3):
            if board[0][col] == board[1][col] == board[2][col] != "":
                return board[0][col]
        # Diagonals
        if board[0][0] == board[1][1] == board[2][2] != "":
            return board[0][0]
        if board[0][2] == board[1][1] == board[2][0] != "":
            return board[0][2]
        return None
    
    def _is_board_full(self, board: List) -> bool:
        """Check if board is full"""
        return all(board[i][j] != "" for i in range(3) for j in range(3))
    
    # ==================== CONNECT 4 AI ====================
    
    def connect4_move(self, game_state: Dict) -> Dict:
        """AI for Connect 4"""
        board = game_state["board"]
        
        if self.difficulty == "easy":
            # Random valid column
            valid_cols = [col for col in range(7) if board[0][col] == ""]
            if valid_cols:
                return {"column": secure_random.choice(valid_cols)}  # Use 'column' to match frontend
        
        # Medium/Hard: Check winning moves and blocks
        for col in range(7):
            if self._is_valid_connect4_move(board, col):
                # Try winning move
                temp_board = [row[:] for row in board]
                row = self._get_connect4_row(temp_board, col)
                temp_board[row][col] = "yellow"  # AI is Yellow
                if self._check_connect4_winner(temp_board, row, col, "yellow"):
                    return {"column": col}  # Use 'column' to match frontend
        
        # Block opponent winning move
        for col in range(7):
            if self._is_valid_connect4_move(board, col):
                temp_board = [row[:] for row in board]
                row = self._get_connect4_row(temp_board, col)
                temp_board[row][col] = "red"  # Opponent is Red
                if self._check_connect4_winner(temp_board, row, col, "red"):
                    return {"column": col}  # Use 'column' to match frontend
        
        # Prefer center columns
        center_cols = [3, 2, 4, 1, 5, 0, 6]
        for col in center_cols:
            if self._is_valid_connect4_move(board, col):
                return {"column": col}  # Use 'column' to match frontend
        
        return {"column": 3}  # Use 'column' to match frontend
    
    def _is_valid_connect4_move(self, board: List, col: int) -> bool:
        """Check if column has space"""
        return board[0][col] == ""
    
    def _get_connect4_row(self, board: List, col: int) -> int:
        """Get row where piece will land"""
        for row in range(5, -1, -1):
            if board[row][col] == "":
                return row
        return 0
    
    def _check_connect4_winner(self, board: List, row: int, col: int, player: str) -> bool:
        """Check if move creates 4 in a row"""
        directions = [(0, 1), (1, 0), (1, 1), (1, -1)]
        for dr, dc in directions:
            count = 1
            for d in [1, -1]:
                r, c = row + dr * d, col + dc * d
                while 0 <= r < 6 and 0 <= c < 7 and board[r][c] == player:
                    count += 1
                    r += dr * d
                    c += dc * d
            if count >= 4:
                return True
        return False
    
    # ==================== BLACKJACK AI ====================
    
    def blackjack_move(self, game_state: Dict) -> Dict:
        """Enhanced Blackjack AI with basic strategy"""
        dealer_hand = game_state.get("dealer_hand", [])
        ai_hand = game_state.get("ai_hand", [])
        
        if not dealer_hand or not ai_hand:
            return {"action": "stand"}
        
        ai_value = self._calculate_hand_value(ai_hand)
        
        # Get dealer's up card (first card shown)
        dealer_up_card = self._calculate_hand_value([dealer_hand[0]])
        
        # Check for soft hand (has usable Ace)
        has_ace = any(card[:-1] == 'A' for card in ai_hand)
        soft_hand = has_ace and ai_value <= 21
        
        # Basic Blackjack Strategy
        if soft_hand:
            # Soft hand strategy
            if ai_value <= 17:
                return {"action": "hit"}
            elif ai_value == 18:
                # Soft 18: hit against 9, 10, A
                if dealer_up_card >= 9:
                    return {"action": "hit"}
                return {"action": "stand"}
            else:
                return {"action": "stand"}
        else:
            # Hard hand strategy
            if ai_value <= 11:
                return {"action": "hit"}
            elif ai_value == 12:
                # Hit against 2, 3, 7+; stand against 4-6
                if dealer_up_card <= 3 or dealer_up_card >= 7:
                    return {"action": "hit"}
                return {"action": "stand"}
            elif 13 <= ai_value <= 16:
                # Stand against dealer 2-6, hit against 7+
                if dealer_up_card >= 7:
                    return {"action": "hit"}
                return {"action": "stand"}
            else:  # 17+
                return {"action": "stand"}
    
    def _calculate_hand_value(self, hand: List[str]) -> int:
        """Calculate blackjack hand value"""
        value = 0
        aces = 0
        for card in hand:
            rank = card[:-1]
            if rank in ["J", "Q", "K"]:
                value += 10
            elif rank == "A":
                aces += 1
                value += 11
            else:
                value += int(rank)
        
        while value > 21 and aces > 0:
            value -= 10
            aces -= 1
        
        return value
    
    # ==================== UNO AI ====================
    
    def uno_move(self, game_state: Dict) -> Dict:
        """Smart UNO AI with full special card support"""
        ai_hand = game_state.get("ai_hand", [])
        top_card = game_state.get("top_card", "")
        current_color = game_state.get("current_color", "R")
        draw_stack = game_state.get("draw_stack", 0)
        
        if not ai_hand:
            return {"action": "draw"}
        
        # If there's a draw stack, try to stack another draw card
        if draw_stack > 0:
            for card in ai_hand:
                if card.endswith('DRAW2') or card == 'WILDDRAW4':
                    chosen_color = self._choose_wild_color(ai_hand) if card.startswith('WILD') else None
                    return {"action": "play", "card": card, "wild_color": chosen_color}
            # Must draw if can't stack
            return {"action": "draw"}
        
        # Priority ranking for card selection
        playable_cards = []
        
        for card in ai_hand:
            priority = 0
            
            # Wild Draw Four - highest priority (save for strategic moments)
            if card == 'WILDDRAW4':
                # Only play if no other options or AI has few cards left
                if len(ai_hand) <= 3:
                    priority = 100
                else:
                    priority = 50
                playable_cards.append((priority, card))
            
            # Regular Wild - high priority
            elif card == 'WILD':
                priority = 60
                playable_cards.append((priority, card))
            
            # Colored cards
            elif len(card) > 1 and card[0] in ['R', 'G', 'B', 'Y']:
                card_color = card[0]
                card_type = card[1:]
                
                # Check if playable (color or type match)
                top_type = top_card[1:] if len(top_card) > 1 and top_card[0] in ['R', 'G', 'B', 'Y'] else ""
                
                if card_color == current_color or card_type == top_type:
                    # Draw Two - very high priority
                    if card.endswith('DRAW2'):
                        priority = 90
                    # Skip - high priority
                    elif card.endswith('SKIP'):
                        priority = 80
                    # Reverse - high priority
                    elif card.endswith('REVERSE'):
                        priority = 70
                    # Matching type (number) - medium priority
                    elif card_type == top_type and card_type.isdigit():
                        priority = 40
                    # Matching color only - lower priority
                    elif card_color == current_color:
                        priority = 30
                    
                    playable_cards.append((priority, card))
        
        # Play highest priority card
        if playable_cards:
            playable_cards.sort(reverse=True, key=lambda x: x[0])
            selected_card = playable_cards[0][1]
            
            # Choose color for wild cards
            chosen_color = None
            if selected_card.startswith('WILD'):
                chosen_color = self._choose_wild_color(ai_hand)
            
            return {"action": "play", "card": selected_card, "wild_color": chosen_color}
        
        # No playable cards - draw
        return {"action": "draw"}
    
    def _choose_wild_color(self, hand: List[str]) -> str:
        """Choose best color for wild card based on AI's hand"""
        color_counts = {"R": 0, "G": 0, "B": 0, "Y": 0}
        
        for card in hand:
            if card and len(card) > 0 and card[0] in color_counts:
                color_counts[card[0]] += 1
        
        # Return color with most cards, default to Red
        return max(color_counts, key=color_counts.get, default="R")
    
    # ==================== GO FISH AI ====================
    
    def go_fish_move(self, game_state: Dict) -> Dict:
        """Memory-based Go Fish AI"""
        ai_hand = game_state.get("ai_hand", [])
        
        if not ai_hand:
            return {"action": "draw"}
        
        # Count ranks in hand
        rank_counts = {}
        for card in ai_hand:
            rank = card[:-1]
            rank_counts[rank] = rank_counts.get(rank, 0) + 1
        
        # Ask for rank we have most of (but not 4)
        best_rank = None
        best_count = 0
        for rank, count in rank_counts.items():
            if count < 4 and count > best_count:
                best_count = count
                best_rank = rank
        
        if best_rank:
            return {"action": "ask", "rank": best_rank}
        
        # Fallback: ask for any rank we have
        if ai_hand:
            return {"action": "ask", "rank": ai_hand[0][:-1]}
        
        return {"action": "draw"}
    
    # ==================== CRAZY EIGHTS AI ====================
    
    def crazy_eights_move(self, game_state: Dict) -> Dict:
        """Strategic Crazy Eights AI"""
        ai_hand = game_state.get("ai_hand", [])
        top_card = game_state.get("top_card", "")
        
        if not top_card or not ai_hand:
            return {"action": "draw"}
        
        top_suit = top_card[-1]
        top_rank = top_card[:-1]
        
        # Priority: Save 8s for later > Match rank > Match suit
        playable_cards = []
        eights = []
        
        for card in ai_hand:
            card_suit = card[-1]
            card_rank = card[:-1]
            
            if card_rank == "8":
                eights.append(card)
            elif card_rank == top_rank or card_suit == top_suit:
                if card_rank == top_rank:
                    playable_cards.append((1, card))
                else:
                    playable_cards.append((0, card))
        
        # Play non-eight if possible
        if playable_cards:
            playable_cards.sort(reverse=True)
            return {"action": "play", "card": playable_cards[0][1]}
        
        # Use eight as last resort
        if eights:
            # Choose suit we have most of
            suit_counts = {"H": 0, "D": 0, "C": 0, "S": 0}
            for card in ai_hand:
                if card[-1] in suit_counts:
                    suit_counts[card[-1]] += 1
            chosen_suit = max(suit_counts, key=suit_counts.get)
            return {"action": "play", "card": eights[0], "chosen_suit": chosen_suit}
        
        return {"action": "draw"}
    
    # ==================== ENHANCED AI FOR COMPLEX GAMES ====================
    
    def checkers_move(self, game_state: Dict) -> Dict:
        """Enhanced Checkers AI with capture priority and multi-jump support"""
        board = game_state.get("board", [])
        ai_pieces = []
        
        # Find all AI pieces
        for i in range(8):
            for j in range(8):
                if isinstance(board[i][j], dict) and board[i][j].get("player") == "ai":
                    ai_pieces.append((i, j, board[i][j].get("king", False)))
        
        if not ai_pieces:
            return {"action": "move", "from": [0, 0], "to": [1, 1]}
        
        # PRIORITY 1: Forced jumps (captures)
        best_jump = None
        max_captures = 0
        
        for row, col, is_king in ai_pieces:
            jumps = self._get_all_checker_jumps(board, (row, col), is_king)
            if jumps and len(jumps) > max_captures:
                max_captures = len(jumps)
                best_jump = {"from": [row, col], "to": jumps[0]}
        
        if best_jump:
            return {"action": "move", **best_jump}
        
        # PRIORITY 2: Advance pieces toward promotion
        for row, col, is_king in sorted(ai_pieces, key=lambda x: x[0], reverse=True):
            moves = self._get_checker_regular_moves(board, (row, col), is_king, "ai")
            if moves:
                # Prefer moves that advance (increase row for AI)
                if moves:
                    best_move = max(moves, key=lambda m: m[0])
                    return {"action": "move", "from": [row, col], "to": best_move}
        
        # FALLBACK: Any valid move
        for row, col, is_king in ai_pieces:
            moves = self._get_checker_regular_moves(board, (row, col), is_king, "ai")
            if moves:
                return {"action": "move", "from": [row, col], "to": list(moves[0])}
        
        return {"action": "move", "from": [0, 0], "to": [1, 1]}
    
    def _get_checker_jumps(self, board: List, pos: Tuple) -> List:
        """Get possible jump moves for a checker piece"""
        jumps = []
        row, col = pos
        directions = [(2, 2), (2, -2), (-2, 2), (-2, -2)]
        
        for dr, dc in directions:
            new_row, new_col = row + dr, col + dc
            mid_row, mid_col = row + dr//2, col + dc//2
            
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                target = board[new_row][new_col]
                mid_piece = board[mid_row][mid_col]
                if (target is None or target == "") and isinstance(mid_piece, dict):
                    if mid_piece.get("player") == "player":
                        jumps.append([new_row, new_col])
        
        return jumps
    
    def _get_checker_moves(self, board: List, pos: Tuple) -> List:
        """Get possible regular moves for a checker piece"""
        moves = []
        row, col = pos
        piece = board[row][col]
        is_king = piece.get("king", False) if isinstance(piece, dict) else False
        
        # Regular pieces move diagonally forward, kings move any diagonal
        if is_king:
            directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
        else:
            # AI pieces move down (increasing row), player pieces move up
            is_ai = piece.get("player") == "ai" if isinstance(piece, dict) else False
            directions = [(1, 1), (1, -1)] if is_ai else [(-1, 1), (-1, -1)]
        
        for dr, dc in directions:
            new_row, new_col = row + dr, col + dc
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                target = board[new_row][new_col]
                if target is None or target == "":
                    moves.append([new_row, new_col])
        
        return moves
    
    def _get_checker_regular_moves(self, board: List, pos: Tuple, is_king: bool, player: str) -> List:
        """Get regular (non-jump) moves for a checker piece"""
        moves = []
        row, col = pos
        
        if is_king:
            directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
        else:
            # AI moves down (increase row), player moves up (decrease row)
            directions = [(1, 1), (1, -1)] if player == "ai" else [(-1, 1), (-1, -1)]
        
        for dr, dc in directions:
            new_row, new_col = row + dr, col + dc
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                target = board[new_row][new_col]
                if not target or target == "" or target is None:
                    moves.append([new_row, new_col])
        
        return moves
    
    def _get_all_checker_jumps(self, board: List, pos: Tuple, is_king: bool) -> List:
        """Get all possible jump moves (captures) for a checker piece"""
        jumps = []
        row, col = pos
        
        if is_king:
            directions = [(2, 2), (2, -2), (-2, 2), (-2, -2)]
        else:
            # AI jumps down, player jumps up
            piece = board[row][col]
            is_ai = piece.get("player") == "ai" if isinstance(piece, dict) else False
            directions = [(2, 2), (2, -2)] if is_ai else [(-2, 2), (-2, -2)]
        
        for dr, dc in directions:
            new_row, new_col = row + dr, col + dc
            mid_row, mid_col = row + dr//2, col + dc//2
            
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                target = board[new_row][new_col]
                mid_piece = board[mid_row][mid_col]
                
                # Can jump if target is empty and middle has opponent piece
                if (not target or target == "" or target is None) and isinstance(mid_piece, dict):
                    piece = board[row][col]
                    if isinstance(piece, dict):
                        if mid_piece.get("player") != piece.get("player"):
                            jumps.append([new_row, new_col])
        
        return jumps
    
    def reversi_move(self, game_state: Dict) -> Dict:
        """Enhanced Reversi AI with corner/edge strategy and pass detection"""
        board = game_state.get("board", [[]])
        size = len(board) if board else 8
        
        # Get all valid moves
        valid_moves = []
        for i in range(size):
            for j in range(size):
                if self._is_valid_reversi_move(board, i, j, "ai"):
                    score = self._evaluate_reversi_position(i, j, size)
                    flip_count = self._count_reversi_flips(board, i, j, "ai")
                    # Prioritize corners, then edges, then flip count
                    total_score = score + flip_count
                    valid_moves.append((total_score, i, j))
        
        if valid_moves:
            # Sort by score (corners and edges are valuable)
            valid_moves.sort(reverse=True)
            _, row, col = valid_moves[0]
            return {"row": row, "col": col}
        
        # No valid moves - must pass
        return {"action": "pass", "row": 0, "col": 0}
    
    def _count_reversi_flips(self, board: List, row: int, col: int, player: str) -> int:
        """Count how many pieces would be flipped by this move"""
        if not board or row >= len(board) or col >= len(board[0]):
            return 0
        if board[row][col] != "":
            return 0
        
        opponent = "player" if player == "ai" else "ai"
        directions = [(-1,-1), (-1,0), (-1,1), (0,-1), (0,1), (1,-1), (1,0), (1,1)]
        total_flips = 0
        
        for dr, dc in directions:
            r, c = row + dr, col + dc
            flips_in_direction = 0
            
            while 0 <= r < len(board) and 0 <= c < len(board[0]) and board[r][c] == opponent:
                flips_in_direction += 1
                r += dr
                c += dc
            
            if flips_in_direction > 0 and 0 <= r < len(board) and 0 <= c < len(board[0]) and board[r][c] == player:
                total_flips += flips_in_direction
        
        return total_flips
    
    def _is_valid_reversi_move(self, board: List, row: int, col: int, player: str) -> bool:
        """Check if a move is valid in Reversi"""
        if board[row][col] != "":
            return False
        
        opponent = "player" if player == "ai" else "ai"
        directions = [(-1,-1), (-1,0), (-1,1), (0,-1), (0,1), (1,-1), (1,0), (1,1)]
        
        for dr, dc in directions:
            r, c = row + dr, col + dc
            found_opponent = False
            
            while 0 <= r < len(board) and 0 <= c < len(board[0]) and board[r][c] == opponent:
                found_opponent = True
                r += dr
                c += dc
            
            if found_opponent and 0 <= r < len(board) and 0 <= c < len(board[0]) and board[r][c] == player:
                return True
        
        return False
    
    def _evaluate_reversi_position(self, row: int, col: int, size: int) -> int:
        """Evaluate Reversi position (corners are best, edges are good)"""
        # Corners are most valuable
        if (row == 0 or row == size-1) and (col == 0 or col == size-1):
            return 100
        # Edges are good
        if row == 0 or row == size-1 or col == 0 or col == size-1:
            return 10
        # Avoid positions next to corners
        if (row in [1, size-2]) and (col in [1, size-2]):
            return -10
        # Center is okay
        return 1
    
    def chess_move(self, game_state: Dict) -> Dict:
        """Chess AI using python-chess library with FEN notation"""
        import chess
        
        fen = game_state.get("fen", "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
        
        try:
            board = chess.Board(fen)
            
            # Get all legal moves
            legal_moves = list(board.legal_moves)
            
            if not legal_moves:
                return {"from": "e7", "to": "e5", "fen": fen}  # Fallback
            
            # Easy: Random move
            if self.difficulty == "easy":
                move = secure_random.choice(legal_moves)
                board.push(move)
                return {
                    "from": move.uci()[:2],
                    "to": move.uci()[2:4],
                    "fen": board.fen()
                }
            
            # Medium/Hard: Basic evaluation
            best_move = None
            best_score = float('-inf')
            
            piece_values = {
                chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3,
                chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0
            }
            
            for move in legal_moves:
                score = 0
                
                # Capture bonus
                if board.is_capture(move):
                    captured_piece = board.piece_at(move.to_square)
                    if captured_piece:
                        score += piece_values.get(captured_piece.piece_type, 0) * 10
                
                # Check bonus
                board.push(move)
                if board.is_check():
                    score += 5
                if board.is_checkmate():
                    score += 10000
                board.pop()
                
                # Center control
                to_square = move.to_square
                if to_square in [27, 28, 35, 36]:  # e4, d4, e5, d5
                    score += 2
                
                # Add some randomness for medium difficulty
                if self.difficulty == "medium":
                    # secure_random.uniform doesn't exist — SystemRandom inherits
                    # from Random, so .uniform IS available. Use it for fairness.
                    score += secure_random.uniform(-1, 1)
                
                if score > best_score:
                    best_score = score
                    best_move = move
            
            if best_move:
                board.push(best_move)
                return {
                    "from": best_move.uci()[:2],
                    "to": best_move.uci()[2:4],
                    "fen": board.fen()
                }
            
        except Exception as e:
            print(f"Chess AI error: {e}")
        
        # Fallback
        return {"from": "e7", "to": "e5", "fen": fen}
    
    def _get_chess_moves_array(self, board: List, row: int, col: int, piece: str) -> List:
        """Get possible chess moves for a piece using array board format"""
        moves = []
        piece_type = piece[1] if len(piece) > 1 else piece
        is_white = piece.startswith('w')
        
        # Pawn moves
        if piece_type == 'P':
            direction = 1 if not is_white else -1  # Black moves down, white moves up
            start_row = 1 if not is_white else 6
            
            # Forward one
            new_row = row + direction
            if 0 <= new_row < 8 and board[new_row][col] == "":
                moves.append((new_row, col))
                # Forward two from start
                if row == start_row:
                    new_row_2 = row + 2 * direction
                    if board[new_row_2][col] == "":
                        moves.append((new_row_2, col))
            
            # Captures
            for dc in [-1, 1]:
                new_col = col + dc
                if 0 <= new_row < 8 and 0 <= new_col < 8:
                    target = board[new_row][new_col]
                    if target and ((is_white and target.startswith('b')) or (not is_white and target.startswith('w'))):
                        moves.append((new_row, new_col))
        
        # Knight moves
        elif piece_type == 'N':
            knight_moves = [(2,1), (2,-1), (-2,1), (-2,-1), (1,2), (1,-2), (-1,2), (-1,-2)]
            for dr, dc in knight_moves:
                new_row, new_col = row + dr, col + dc
                if 0 <= new_row < 8 and 0 <= new_col < 8:
                    target = board[new_row][new_col]
                    if not target or (is_white and target.startswith('b')) or (not is_white and target.startswith('w')):
                        moves.append((new_row, new_col))
        
        # Bishop moves
        elif piece_type == 'B':
            for dr, dc in [(-1,-1), (-1,1), (1,-1), (1,1)]:
                for i in range(1, 8):
                    new_row, new_col = row + dr*i, col + dc*i
                    if not (0 <= new_row < 8 and 0 <= new_col < 8):
                        break
                    target = board[new_row][new_col]
                    if not target:
                        moves.append((new_row, new_col))
                    elif (is_white and target.startswith('b')) or (not is_white and target.startswith('w')):
                        moves.append((new_row, new_col))
                        break
                    else:
                        break
        
        # Rook moves
        elif piece_type == 'R':
            for dr, dc in [(-1,0), (1,0), (0,-1), (0,1)]:
                for i in range(1, 8):
                    new_row, new_col = row + dr*i, col + dc*i
                    if not (0 <= new_row < 8 and 0 <= new_col < 8):
                        break
                    target = board[new_row][new_col]
                    if not target:
                        moves.append((new_row, new_col))
                    elif (is_white and target.startswith('b')) or (not is_white and target.startswith('w')):
                        moves.append((new_row, new_col))
                        break
                    else:
                        break
        
        # Queen moves (combination of rook and bishop)
        elif piece_type == 'Q':
            for dr, dc in [(-1,-1), (-1,0), (-1,1), (0,-1), (0,1), (1,-1), (1,0), (1,1)]:
                for i in range(1, 8):
                    new_row, new_col = row + dr*i, col + dc*i
                    if not (0 <= new_row < 8 and 0 <= new_col < 8):
                        break
                    target = board[new_row][new_col]
                    if not target:
                        moves.append((new_row, new_col))
                    elif (is_white and target.startswith('b')) or (not is_white and target.startswith('w')):
                        moves.append((new_row, new_col))
                        break
                    else:
                        break
        
        # King moves
        elif piece_type == 'K':
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr == 0 and dc == 0:
                        continue
                    new_row, new_col = row + dr, col + dc
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        target = board[new_row][new_col]
                        if not target or (is_white and target.startswith('b')) or (not is_white and target.startswith('w')):
                            moves.append((new_row, new_col))
        
        return moves
    
    def ludo_move(self, game_state: Dict) -> Dict:
        """Simplified Ludo AI"""
        return {"piece": 0, "spaces": 1}
    
    def backgammon_move(self, game_state: Dict) -> Dict:
        """Simplified Backgammon AI"""
        return {"from": 0, "to": 1}
    
    def hearts_move(self, game_state: Dict) -> Dict:
        """Enhanced Hearts AI - avoid hearts and Queen of Spades"""
        ai_hand = game_state.get("ai_hand", [])
        current_trick = game_state.get("current_trick", [])
        
        if not ai_hand:
            return {"card": "2C"}
        
        # If leading (no cards in trick yet)
        if not current_trick:
            # Try to lead with lowest non-heart
            non_hearts = [c for c in ai_hand if c[-1] != "H" and c != "QS"]
            if non_hearts:
                # Lead lowest rank
                rank_order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
                non_hearts.sort(key=lambda x: rank_order.index(x[:-1]))
                return {"card": non_hearts[0]}
            # If only hearts, lead lowest heart
            hearts = [c for c in ai_hand if c[-1] == "H"]
            if hearts:
                rank_order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
                hearts.sort(key=lambda x: rank_order.index(x[:-1]))
                return {"card": hearts[0]}
            return {"card": ai_hand[0]}
        
        # Following - need to match lead suit if possible
        lead_card = current_trick[0] if isinstance(current_trick[0], str) else current_trick[0].get("card")
        lead_suit = lead_card[-1]
        
        # Cards in lead suit
        matching_suit = [c for c in ai_hand if c[-1] == lead_suit]
        
        if matching_suit:
            # Play lowest card in suit (don't win if possible)
            rank_order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
            matching_suit.sort(key=lambda x: rank_order.index(x[:-1]))
            return {"card": matching_suit[0]}
        else:
            # Can't follow suit - dump Queen of Spades if have it
            if "QS" in ai_hand:
                return {"card": "QS"}
            # Otherwise dump highest heart
            hearts = [c for c in ai_hand if c[-1] == "H"]
            if hearts:
                rank_order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
                hearts.sort(key=lambda x: rank_order.index(x[:-1]), reverse=True)
                return {"card": hearts[0]}
            # Otherwise play highest card
            rank_order = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
            ai_hand.sort(key=lambda x: rank_order.index(x[:-1]), reverse=True)
            return {"card": ai_hand[0]}
    
    def spades_move(self, game_state: Dict) -> Dict:
        """Spades AI"""
        return {"action": "bid", "bid": 3}
    
    def rummy_move(self, game_state: Dict) -> Dict:
        """Rummy AI - form sets"""
        return {"action": "draw"}
    
    def poker_move(self, game_state: Dict) -> Dict:
        """Enhanced Poker AI with hand evaluation"""
        ai_hand = game_state.get("ai_hand", [])
        community = game_state.get("community_cards", [])
        pot = game_state.get("pot", 100)
        current_bet = game_state.get("current_bet", 10)
        phase = game_state.get("phase", "preflop")
        
        if not ai_hand:
            return {"action": "fold"}
        
        # Evaluate hand strength (0-9, 9 being Royal Flush)
        hand_strength = self._evaluate_poker_hand(ai_hand + community)
        
        # Pre-flop strategy
        if phase == "preflop":
            # Strong starting hands
            if self._is_premium_starting_hand(ai_hand):
                if self.difficulty == "hard":
                    return {"action": "raise", "amount": current_bet * 3}
                return {"action": "call"}
            # Medium hands
            elif self._is_playable_starting_hand(ai_hand):
                return {"action": "call"}
            # Weak hands
            else:
                if current_bet <= 20:  # Cheap to see flop
                    return {"action": "call"}
                return {"action": "fold"}
        
        # Post-flop strategy based on hand strength
        pot_odds = current_bet / (pot + current_bet) if pot > 0 else 0
        
        # Strong hands (3 of a kind or better)
        if hand_strength >= 3:
            if self.difficulty == "hard":
                return {"action": "raise", "amount": int(pot * 0.75)}
            return {"action": "call"}
        
        # Medium hands (pair or two pair)
        elif hand_strength >= 1:
            if pot_odds < 0.3:  # Good pot odds
                return {"action": "call"}
            return {"action": "fold"}
        
        # Weak hands
        else:
            if current_bet == 0:  # Free to check
                return {"action": "call"}  # Check
            return {"action": "fold"}
    
    def _evaluate_poker_hand(self, cards: List[str]) -> int:
        """Evaluate poker hand strength (0-9)"""
        if len(cards) < 5:
            return 0
        
        # Parse cards
        ranks = [self._card_rank_value(c[:-1]) for c in cards]
        suits = [c[-1] for c in cards]
        rank_counts = {}
        for r in ranks:
            rank_counts[r] = rank_counts.get(r, 0) + 1
        
        # Check for flush
        is_flush = any(suits.count(s) >= 5 for s in suits)
        
        # Check for straight
        unique_ranks = sorted(set(ranks), reverse=True)
        is_straight = False
        for i in range(len(unique_ranks) - 4):
            if unique_ranks[i] - unique_ranks[i+4] == 4:
                is_straight = True
                break
        # Special case: A-2-3-4-5 straight
        if set([14, 2, 3, 4, 5]).issubset(set(ranks)):
            is_straight = True
        
        # Royal Flush
        if is_flush and is_straight and 14 in ranks and 13 in ranks:
            return 9
        # Straight Flush
        if is_flush and is_straight:
            return 8
        # Four of a kind
        if 4 in rank_counts.values():
            return 7
        # Full house
        if 3 in rank_counts.values() and 2 in rank_counts.values():
            return 6
        # Flush
        if is_flush:
            return 5
        # Straight
        if is_straight:
            return 4
        # Three of a kind
        if 3 in rank_counts.values():
            return 3
        # Two pair
        pairs = [r for r, c in rank_counts.items() if c == 2]
        if len(pairs) >= 2:
            return 2
        # One pair
        if 2 in rank_counts.values():
            return 1
        # High card
        return 0
    
    def _card_rank_value(self, rank: str) -> int:
        """Convert card rank to numeric value"""
        if rank == 'A':
            return 14
        elif rank == 'K':
            return 13
        elif rank == 'Q':
            return 12
        elif rank == 'J':
            return 11
        else:
            return int(rank)
    
    def _is_premium_starting_hand(self, hand: List[str]) -> bool:
        """Check if hand is premium (AA, KK, QQ, AK)"""
        if len(hand) != 2:
            return False
        ranks = [self._card_rank_value(c[:-1]) for c in hand]
        ranks.sort(reverse=True)
        # Pocket pairs 10 or higher
        if ranks[0] == ranks[1] and ranks[0] >= 10:
            return True
        # A-K suited or unsuited
        if ranks[0] == 14 and ranks[1] >= 12:
            return True
        return False
    
    def _is_playable_starting_hand(self, hand: List[str]) -> bool:
        """Check if hand is playable"""
        if len(hand) != 2:
            return False
        ranks = [self._card_rank_value(c[:-1]) for c in hand]
        ranks.sort(reverse=True)
        # Any pocket pair
        if ranks[0] == ranks[1]:
            return True
        # High cards
        if ranks[0] >= 10 and ranks[1] >= 9:
            return True
        # Suited connectors
        if hand[0][-1] == hand[1][-1] and abs(ranks[0] - ranks[1]) <= 2:
            return True
        return False


# ==================== AI DIFFICULTY SETTINGS ====================

AI_DIFFICULTY_SETTINGS = {
    "easy": {
        "randomness": 0.3,  # 30% random moves
        "think_time": 0.5,  # Seconds
        "description": "Makes mistakes often"
    },
    "medium": {
        "randomness": 0.1,  # 10% random moves
        "think_time": 1.0,
        "description": "Balanced opponent"
    },
    "hard": {
        "randomness": 0.0,  # No random moves
        "think_time": 1.5,
        "description": "Plays optimally"
    }
}
