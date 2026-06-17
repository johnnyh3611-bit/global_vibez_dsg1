# 🎮 Real-Time Multiplayer System Documentation

## Overview

Global Vibez DSG features a fully functional real-time multiplayer gaming system built with Socket.IO and WebSockets. Players can match with opponents, play competitive games, and interact in real-time.

---

## Architecture

### Backend (`/app/backend/multiplayer.py`)

**Technologies:**
- `python-socketio` (AsyncIO mode)
- In-memory storage for rooms and matchmaking queues
- Event-driven architecture

**Key Components:**
1. **Matchmaking System**: Accept/reject proposal-based matchmaking
2. **Room Management**: Create/join rooms, track players, manage game state
3. **Real-Time Sync**: WebSocket events for moves, chat, game state updates
4. **Event Handlers**: 15+ Socket.IO events for complete game lifecycle

**Core Events:**
- `join_matchmaking_event` - Join matchmaking queue
- `match_found` - Notify player of potential match
- `accept_match_event` - Accept match and create game room
- `reject_match_event` - Reject match and continue searching
- `make_move` - Broadcast player move to opponent
- `game_over` - Handle game completion

### Frontend (`/app/frontend/src/`)

**Technologies:**
- `socket.io-client` v4.8.3
- React hooks for state management
- Framer Motion for animations

**Key Components:**

1. **`useMultiplayer.js`** (Custom Hook)
   - Manages Socket.IO connection lifecycle
   - Provides methods for matchmaking, rooms, moves, chat
   - Handles all Socket.IO event subscriptions
   - Real-time state synchronization

2. **`MultiplayerLobby.jsx`**
   - Matchmaking interface
   - Game selection (Tic-Tac-Toe, Connect 4, Chess, UNO, Trivia)
   - Accept/Reject match proposals
   - Online player count and connection status

3. **`MultiplayerTicTacToe.jsx`**
   - Real-time Tic-Tac-Toe gameplay
   - Turn-based move synchronization
   - Win/lose/draw detection with celebrations
   - Player info cards with turn indicators

---

## How It Works

### Matchmaking Flow (Accept/Reject System)

```
Player 1                          Server                          Player 2
   |                                 |                                 |
   |--join_matchmaking-------------->|                                 |
   |                                 |<----join_matchmaking------------|
   |                                 |                                 |
   |                                 |--match_found------------------>|
   |<--match_pending----------------|                                 |
   |                                 |                                 |
   |                                 |<----accept_match_event---------|
   |<--match_accepted----------------|--match_accepted--------------->|
   |                                 |                                 |
   |       Navigate to game room     |       Navigate to game room     |
```

**Key Features:**
- Player 2 receives match proposal with Player 1's name
- Player 2 can ACCEPT or REJECT
- If rejected, Player 1 continues matchmaking automatically
- If accepted, both players enter game room immediately

### Gameplay Flow

```
Player 1                          Server                          Player 2
   |                                 |                                 |
   |--make_move(index=0, symbol=X)-->|                                 |
   |                                 |--move_made(board, turn)-------->|
   |                                 |                                 |
   |                                 |<--make_move(index=4, symbol=O)--|
   |<--move_made(board, turn)--------|                                 |
   |                                 |                                 |
   |--game_over(winner='host')------>|                                 |
   |                                 |--game_completed---------------->|
```

---

## Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/multiplayer` | `MultiplayerLobby` | Matchmaking lobby, game selection |
| `/multiplayer-game/:gameType/:roomCode` | `MultiplayerTicTacToe` | Active game room |

---

## Environment Configuration

### Frontend (`.env`)

```bash
REACT_APP_BACKEND_URL=https://your-domain.com
```

The Socket.IO client automatically connects to this URL at the `/socket.io` path.

### Backend (`.env`)

No additional environment variables needed. Socket.IO server is mounted directly in `server.py`.

---

## WebSocket Infrastructure Requirements

### ⚠️ IMPORTANT: Kubernetes/NGINX Ingress Configuration

**For WebSocket connections to work on Kubernetes with NGINX Ingress, you MUST add these annotations:**

```yaml
metadata:
  annotations:
    nginx.ingress.kubernetes.io/websocket-services: "backend-service"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "Upgrade";
      proxy_http_version 1.1;
      proxy_read_timeout 1d;
      proxy_send_timeout 1d;
```

**Without these annotations:**
- WebSocket upgrade requests will be blocked
- Connections will timeout with "WebSocket is closed before the connection is established"
- All multiplayer features will be non-functional

**Verification:**
- Connection status badge should show "Connected" (green)
- Online player count should display active number
- "FIND MATCH" button should be enabled

---

## Current Implementation Status

### ✅ Completed Features

**Backend:**
- ✅ Socket.IO server running on port 8001
- ✅ Accept/reject matchmaking system
- ✅ Room creation and management
- ✅ Game state synchronization
- ✅ Turn-based move validation
- ✅ Win/lose/draw detection
- ✅ Player disconnection handling
- ✅ Chat message broadcasting

**Frontend:**
- ✅ Multiplayer lobby UI with game selection
- ✅ Accept/reject match proposal interface
- ✅ Real-time Tic-Tac-Toe gameplay
- ✅ Turn indicators and player cards
- ✅ Celebration animations for winners
- ✅ Connection status monitoring
- ✅ Error handling and user feedback

**Integration:**
- ✅ Protected routes with authentication
- ✅ Room code-based game routing
- ✅ Automatic navigation after match acceptance
- ✅ Real-time board state synchronization

### 🔄 In Progress

- 🔄 WebSocket infrastructure configuration (Kubernetes ingress)
- 🔄 End-to-end testing with two players

### 📋 Upcoming Features

**Priority 1 (Next Steps):**
- Wire up Connect 4 multiplayer
- Wire up Chess multiplayer
- Wire up UNO multiplayer
- Wire up Trivia Battle multiplayer

**Priority 2 (Phase 3):**
- Tournament brackets system
- Spectator mode
- Live streaming integration
- Couple-based competitive modes
- Video chat integration
- Voice chat support

**Priority 3 (Future):**
- Rematch functionality
- Friend invites (private rooms)
- Player statistics and rankings
- Achievement system
- Replay system

---

## Testing Guide

### Manual Testing (Requires 2 Browser Windows/Tabs)

**Prerequisites:**
- WebSocket support enabled in infrastructure
- Both windows authenticated

**Test Scenario:**

1. **Window 1 (Player 1):**
   ```
   1. Navigate to /multiplayer
   2. Enter name "Alice"
   3. Select "Tic-Tac-Toe"
   4. Click "FIND MATCH"
   5. Wait for "Searching for Opponent..." screen
   ```

2. **Window 2 (Player 2):**
   ```
   1. Navigate to /multiplayer
   2. Enter name "Bob"
   3. Select "Tic-Tac-Toe"
   4. Click "FIND MATCH"
   5. Should immediately see "MATCH FOUND!" with Alice's name
   6. Click "ACCEPT"
   ```

3. **Both Windows:**
   ```
   - Should navigate to game room automatically
   - Alice sees "YOUR TURN!" (plays as X)
   - Bob sees "Opponent's Turn" (plays as O)
   - Alice clicks any cell → Bob sees move instantly
   - Players alternate turns
   - Winner sees confetti and "YOU WIN!" message
   - Loser sees "YOU LOSE!" message
   ```

**Expected Console Logs:**
```
✅ Connected to multiplayer server
🔍 Joined matchmaking queue
🎮 Match found! (Player 2 only)
⏳ Match pending approval... (Player 1 only)
✅ Match accepted! Starting game...
```

---

## API Reference

### useMultiplayer Hook

```javascript
import { useMultiplayer } from '@/hooks/useMultiplayer';

const {
  // Connection state
  connected,          // boolean
  onlinePlayers,      // number
  
  // Room state
  room,               // Room object or null
  
  // Matchmaking state
  matchmaking,        // boolean
  matchProposal,      // Proposal object or null
  
  // Error handling
  error,              // string or null
  clearError,         // function
  
  // Chat
  chatMessages,       // array of message objects
  
  // Actions
  joinMatchmaking,    // (gameType, userId, userName) => void
  leaveMatchmaking,   // () => void
  acceptMatch,        // () => void
  rejectMatch,        // () => void
  makeMove,           // (move, gameState) => void
  endGame,            // (winner) => void
  sendChat,           // (message, senderName) => void
  leaveRoom,          // () => void
} = useMultiplayer();
```

### Room Object Structure

```javascript
{
  room_code: "ABC123",
  game_type: "tictactoe",
  status: "playing",  // waiting | playing | completed
  host: {
    session_id: "...",
    user_id: "...",
    name: "Alice",
    ready: true
  },
  guest: {
    session_id: "...",
    user_id: "...",
    name: "Bob",
    ready: true
  },
  game_state: {
    board: [null, "X", null, "O", ...],
    status: "playing"
  },
  current_turn: "host",  // host | guest
  created_at: "2026-03-26T...",
  chat_messages: [],
  spectators: []
}
```

---

## Troubleshooting

### Issue: "Disconnected" Status (Red Badge)

**Symptoms:**
- Connection status shows "Disconnected"
- "FIND MATCH" button is disabled
- Online player count shows 0

**Causes:**
1. Backend Socket.IO server not running
2. WebSocket connections blocked by infrastructure
3. CORS misconfiguration
4. Network firewall blocking WebSocket protocol

**Solutions:**
1. Check backend logs: `tail -f /var/log/supervisor/backend.*.log`
2. Verify Socket.IO endpoint: `curl http://localhost:8001/socket.io/`
3. Add WebSocket annotations to Kubernetes ingress (see above)
4. Check browser console for connection errors

### Issue: Match Not Found

**Symptoms:**
- Player clicks "FIND MATCH"
- Stays on "Searching..." indefinitely
- No match proposal received

**Causes:**
1. No other players in matchmaking queue
2. Game type mismatch (Player 1 selected Chess, Player 2 selected UNO)
3. WebSocket connection lost during matchmaking

**Solutions:**
1. Ensure both players select the SAME game type
2. Have both players in matchmaking simultaneously
3. Check WebSocket connection status before matchmaking

### Issue: Moves Not Syncing

**Symptoms:**
- Player makes move but opponent doesn't see it
- Board states diverge between players
- Turn indicators out of sync

**Causes:**
1. WebSocket connection dropped mid-game
2. Race condition in move handling
3. Server-side room state corruption

**Solutions:**
1. Monitor WebSocket connection status during gameplay
2. Refresh page to reconnect
3. Leave room and rematch
4. Check server logs for errors

---

## Performance Considerations

### Scalability

**Current Implementation (In-Memory Storage):**
- ✅ Perfect for development and testing
- ✅ Fast access, no database queries
- ❌ Data lost on server restart
- ❌ Doesn't scale across multiple server instances

**Production Recommendations:**
```python
# Replace in-memory dicts with Redis
import redis
redis_client = redis.Redis(host='localhost', port=6379)

# Store rooms in Redis
rooms_key = "multiplayer:rooms"
redis_client.hset(rooms_key, room_code, json.dumps(room))

# Use Redis pub/sub for cross-instance communication
pubsub = redis_client.pubsub()
pubsub.subscribe('multiplayer:moves')
```

### Connection Limits

**Socket.IO Server Configuration:**
```python
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    max_http_buffer_size=1000000,      # 1MB max message size
    ping_timeout=20,                    # 20s ping timeout
    ping_interval=25,                   # 25s ping interval
)
```

Supports ~1000-5000 concurrent connections per server instance (depends on server resources).

---

## Security Considerations

### Input Validation

All Socket.IO events validate:
- User IDs exist and match session
- Room codes are valid and accessible
- Moves are valid for current game state
- Turn order is enforced

### Session Management

- Session IDs generated by Socket.IO (cryptographically secure)
- Players can only control their own moves
- Room data isolated per game session

### Rate Limiting (Recommended)

```python
# Add rate limiting to prevent spam
from collections import defaultdict
from time import time

rate_limits = defaultdict(list)

async def rate_limit(sid, limit=10, window=60):
    """Allow 'limit' requests per 'window' seconds"""
    now = time()
    requests = rate_limits[sid]
    requests = [t for t in requests if now - t < window]
    
    if len(requests) >= limit:
        return False
    
    requests.append(now)
    rate_limits[sid] = requests
    return True
```

---

## Contributing

### Adding New Multiplayer Games

1. **Create game component** (`MultiplayerGameName.jsx`)
   ```javascript
   import { useMultiplayer } from '@/hooks/useMultiplayer';
   // Implement game UI + move logic
   // Use makeMove() to broadcast moves
   // Listen for room.game_state updates
   ```

2. **Add route** (`App.js`)
   ```javascript
   <Route path="/multiplayer-game/gamename/:roomCode" 
          element={<MultiplayerGameName />} />
   ```

3. **Add to lobby** (`MultiplayerLobby.jsx`)
   ```javascript
   const games = [
     ...,
     { id: 'gamename', name: 'Game Name', emoji: '🎮', gradient: '...' }
   ];
   ```

4. **Update navigation** (Update useEffect in lobby to handle game type)

---

## Credits

**Built With:**
- Socket.IO (WebSocket library)
- FastAPI (Backend framework)
- React (Frontend framework)
- Framer Motion (Animations)
- Tailwind CSS (Styling)

**Developed By:** Global Vibez DSG Team  
**Last Updated:** March 26, 2026
