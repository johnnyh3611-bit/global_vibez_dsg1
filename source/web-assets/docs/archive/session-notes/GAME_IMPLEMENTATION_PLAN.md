# 🎮 Game Implementation Plan

## 📋 **Overview**
Implementing 3 multiplayer games for couples to play against each other:
1. **Tic Tac Toe** - Simplest, 3x3 grid, turn-based
2. **Connect 4** - Medium complexity, 6x7 grid, gravity mechanics
3. **UNO** - Most complex, card game with draw pile & rules

---

## 🏗️ **Architecture Design**

### **Database Schema** (MongoDB)
```javascript
// games collection
{
  game_id: "game_abc123",
  game_type: "tictactoe", // or "connect4", "uno"
  players: [
    { user_id: "user1", name: "Alice", role: "X" },
    { user_id: "user2", name: "Bob", role: "O" }
  ],
  state: {
    // Game-specific state (board, cards, etc.)
  },
  current_turn: "user1",
  status: "in_progress", // "waiting", "in_progress", "completed"
  winner: null, // user_id of winner, or "draw"
  created_at: "2025-03-14T...",
  last_move_at: "2025-03-14T...",
  match_id: "match_xyz" // Link to the match between users
}
```

### **API Endpoints**
```
POST   /api/games/create          - Create new game session
GET    /api/games/list            - List available games
GET    /api/games/{game_id}       - Get game state
POST   /api/games/{game_id}/move  - Make a move
POST   /api/games/{game_id}/quit  - Forfeit game
GET    /api/games/my-games        - User's active games
```

### **Frontend Components**
```
pages/
  Games.jsx       - Game lobby (list & create)
  GamePlay.jsx    - Universal gameplay container

components/games/
  TicTacToe.jsx   - Tic Tac Toe board
  Connect4.jsx    - Connect 4 board
  UNOGame.jsx     - UNO card game
```

---

## 🎯 **Game 1: Tic Tac Toe**

### **Game Rules**
- 3x3 grid
- 2 players: X and O
- Players take turns placing their mark
- Win: 3 in a row (horizontal, vertical, diagonal)
- Draw: All 9 cells filled with no winner

### **State Structure**
```javascript
state: {
  board: [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""]
  ]
}
```

### **Backend Logic**
1. **Create Game**: Initialize empty 3x3 board, assign X/O roles
2. **Validate Move**: Check if cell is empty & player's turn
3. **Apply Move**: Update board at [row][col]
4. **Check Win**: Check all rows, columns, diagonals
5. **Check Draw**: All cells filled?
6. **Switch Turn**: Toggle current_turn

### **Frontend UI**
- 3x3 grid of clickable cells
- Display whose turn it is
- Highlight winning line
- Show game result (win/draw)
- "Play Again" button

### **Win Condition Logic**
```python
def check_winner(board):
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
    
    # Check draw
    if all(cell != "" for row in board for cell in row):
        return "draw"
    
    return None
```

---

## 🎯 **Game 2: Connect 4**

### **Game Rules**
- 6 rows × 7 columns vertical grid
- 2 players: Red and Yellow
- Players drop pieces from top (gravity)
- Win: 4 in a row (horizontal, vertical, diagonal)
- Draw: All cells filled with no winner

### **State Structure**
```javascript
state: {
  board: [
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""],
    ["", "", "", "", "", "", ""]
  ]
}
```

### **Backend Logic**
1. **Create Game**: Initialize empty 6x7 board, assign Red/Yellow
2. **Validate Move**: Check if column is not full & player's turn
3. **Apply Move**: Find lowest empty row in column (gravity)
4. **Check Win**: Check 4-in-a-row in all directions
5. **Check Draw**: Top row full?
6. **Switch Turn**: Toggle current_turn

### **Gravity Logic**
```python
def drop_piece(board, column, player):
    # Start from bottom row, find first empty cell
    for row in range(5, -1, -1):  # 5 down to 0
        if board[row][column] == "":
            board[row][column] = player
            return row
    return None  # Column is full
```

### **Win Condition Logic**
```python
def check_winner(board, last_row, last_col, player):
    directions = [
        (0, 1),   # Horizontal
        (1, 0),   # Vertical
        (1, 1),   # Diagonal \
        (1, -1)   # Diagonal /
    ]
    
    for dr, dc in directions:
        count = 1  # Start with the piece just placed
        
        # Check forward
        count += count_direction(board, last_row, last_col, dr, dc, player)
        
        # Check backward
        count += count_direction(board, last_row, last_col, -dr, -dc, player)
        
        if count >= 4:
            return player
    
    return None
```

### **Frontend UI**
- 6x7 grid displayed vertically
- Click column to drop piece
- Animate piece falling
- Highlight winning 4 pieces
- "Play Again" button

---

## 🎯 **Game 3: UNO**

### **Game Rules**
- 2 players (for now, can expand to 4 later)
- Each player starts with 7 cards
- Draw pile + discard pile
- Match card by color OR number OR special
- Special cards: Skip, Reverse, Draw 2, Wild, Wild Draw 4
- Win: First player to empty their hand

### **State Structure**
```javascript
state: {
  deck: ["R1", "B2", "G5", ...],  // Draw pile
  discard: ["Y7"],                // Top card
  players: {
    "user1": {
      hand: ["R3", "B5", "G0", "Y9", "WILD", "R7", "B2"],
      card_count: 7
    },
    "user2": {
      hand: ["hidden"],  // Other player can't see
      card_count: 7
    }
  },
  current_color: "yellow",  // If wild was played
  direction: 1  // 1 = clockwise, -1 = counterclockwise
}
```

### **Card Types**
- **Number Cards**: R0-R9, B0-B9, G0-G9, Y0-Y9 (76 cards)
- **Skip**: RS, BS, GS, YS (8 cards)
- **Reverse**: RR, BR, GR, YR (8 cards)
- **Draw 2**: RD2, BD2, GD2, YD2 (8 cards)
- **Wild**: W (4 cards)
- **Wild Draw 4**: WD4 (4 cards)
- **Total**: 108 cards

### **Backend Logic**
1. **Create Game**: Shuffle deck, deal 7 cards each, flip top card
2. **Validate Move**: Check if card matches color/number/is wild
3. **Apply Move**: 
   - Remove card from hand
   - Add to discard pile
   - Execute special effects (skip, draw, etc.)
4. **Check Win**: Hand empty?
5. **Switch Turn**: Next player (respect direction & skips)
6. **Draw Card**: If no playable card, draw from deck

### **Card Matching Logic**
```python
def can_play_card(card, top_card, current_color):
    if card.startswith("W"):  # Wild cards
        return True
    
    # Extract color and value
    card_color = card[0]
    card_value = card[1:]
    
    top_color = current_color if current_color else top_card[0]
    top_value = top_card[1:]
    
    # Match by color or value
    return card_color == top_color or card_value == top_value
```

### **Frontend UI**
- Player's hand displayed at bottom (fanned out)
- Discard pile in center (top card visible)
- Draw pile (face down)
- Opponent's card count (cards face down)
- Color selector modal when Wild is played
- "UNO!" button when 1 card left
- "Draw Card" button

---

## 🔄 **Real-Time Updates**

### **Polling Strategy** (Simple, no WebSocket needed)
```javascript
// Frontend: Poll every 2 seconds for game state updates
useEffect(() => {
  const interval = setInterval(async () => {
    const response = await fetch(`${API}/api/games/${gameId}`);
    const data = await response.json();
    
    if (data.last_move_at !== lastMoveTimestamp) {
      setGameState(data);
      setLastMoveTimestamp(data.last_move_at);
    }
  }, 2000);
  
  return () => clearInterval(interval);
}, [gameId]);
```

---

## 📝 **Implementation Order**

### **Phase 1: Tic Tac Toe** (Days 1-2)
1. ✅ Backend: Create game endpoint
2. ✅ Backend: Move validation & win detection
3. ✅ Frontend: Board UI component
4. ✅ Frontend: Click handlers & turn logic
5. ✅ Test: Play a full game between 2 users

### **Phase 2: Connect 4** (Days 3-4)
1. ✅ Backend: Gravity logic & 6x7 board
2. ✅ Backend: 4-in-a-row win detection
3. ✅ Frontend: Vertical board UI
4. ✅ Frontend: Piece drop animation
5. ✅ Test: Play a full game

### **Phase 3: UNO** (Days 5-7)
1. ✅ Backend: Deck generation & shuffling
2. ✅ Backend: Card matching logic
3. ✅ Backend: Special card effects
4. ✅ Frontend: Card hand UI (fanned layout)
5. ✅ Frontend: Draw/play/wild selection
6. ✅ Test: Play a full game

---

## 🧪 **Testing Checklist**

### **Tic Tac Toe**
- [ ] Player X can make first move
- [ ] Player O can make second move
- [ ] Can't click occupied cell
- [ ] Can't move when it's not your turn
- [ ] Detects horizontal win
- [ ] Detects vertical win
- [ ] Detects diagonal win
- [ ] Detects draw
- [ ] Can start new game after completion

### **Connect 4**
- [ ] Pieces fall to lowest available row
- [ ] Can't drop in full column
- [ ] Detects horizontal 4-in-a-row
- [ ] Detects vertical 4-in-a-row
- [ ] Detects diagonal 4-in-a-row
- [ ] Detects draw
- [ ] Visual animation works

### **UNO**
- [ ] Each player starts with 7 cards
- [ ] Can play card matching color
- [ ] Can play card matching number
- [ ] Can play Wild anytime
- [ ] Skip card skips opponent's turn
- [ ] Draw 2 forces opponent to draw
- [ ] Wild allows color selection
- [ ] Detects win (empty hand)
- [ ] Can draw card if no playable cards

---

## 🚀 **Next Steps**
1. Start with Tic Tac Toe backend implementation
2. Create game state management in MongoDB
3. Build frontend UI component
4. Test multiplayer flow
5. Move to Connect 4
6. Finish with UNO

Let's begin! 🎮
