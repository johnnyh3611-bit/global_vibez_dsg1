# API Documentation - Global Vibez Casino Platform

## 🔗 Base URL

**Production:** `https://your-domain.com/api`  
**Development:** `http://localhost:8001/api`

All endpoints are prefixed with `/api`.

## 🔐 Authentication

Most endpoints require JWT authentication.

**Login:**
```http
POST /api/auth/demo-login
```

**Response:**
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user_id": "demo_abc123",
  "username": "Demo User"
}
```

**Using Token:**
```http
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

---

## 🎰 Casino Games API

### Baccarat

#### Play Baccarat
```http
POST /api/baccarat/play
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "bet_type": "player",      // "player", "banker", or "tie"
  "bet_amount": 100,          // Amount in credits
  "game_mode": "standard"     // "standard", "speed", or "vip"
}
```

**Response (200 OK):**
```json
{
  "game_id": "baccarat_a1b2c3d4e5f6",
  "player_hand": [
    {"value": "K", "suit": "hearts"},
    {"value": "9", "suit": "diamonds"}
  ],
  "banker_hand": [
    {"value": "7", "suit": "clubs"},
    {"value": "2", "suit": "spades"}
  ],
  "player_score": 9,
  "banker_score": 9,
  "winner": "tie",
  "phase": "finished",
  "bet_type": "player",
  "bet_amount": 100,
  "payout": 100               // Tie = push, bet returned
}
```

#### Get Baccarat History
```http
GET /api/baccarat/history?limit=20
Authorization: Bearer {token}
```

**Response:**
```json
{
  "games": [
    {
      "game_id": "baccarat_xyz",
      "bet_type": "banker",
      "bet_amount": 50,
      "winner": "banker",
      "profit": 47,             // 50 * 0.95 - 50 = -3 (lost)
      "created_at": "2025-12-08T10:30:00Z"
    }
  ],
  "total": 15
}
```

#### Get Baccarat Stats
```http
GET /api/baccarat/stats
Authorization: Bearer {token}
```

**Response:**
```json
{
  "total_games": 42,
  "total_wagered": 4200,
  "total_won": 18,
  "total_profit": -350,
  "win_rate": 42.86,
  "favorite_bet": "banker",
  "biggest_win": 500,
  "biggest_loss": -200,
  "bet_distribution": {
    "player": 15,
    "banker": 20,
    "tie": 7
  }
}
```

---

### Bid Whist (4-Player Multiplayer)

#### Start Game
```http
POST /api/bid-whist/start
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "partner_id": "user_partner123",
  "opponent1_id": "user_opp1",
  "opponent2_id": "user_opp2",
  "wager": 100,
  "winning_score": 7          // 7 or 11
}
```

**Response (200 OK):**
```json
{
  "game_id": "bidwhist_abc123",
  "your_position": "north",
  "phase": "bidding",
  "your_hand": [
    {"value": "A", "suit": "spades"},
    {"value": "K", "suit": "hearts"}
    // ... 12 cards total
  ],
  "winning_score": 7
}
```

#### Place Bid
```http
POST /api/bid-whist/bid
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "game_id": "bidwhist_abc123",
  "amount": 5,                // 0=pass, 3-7=bid
  "bid_type": "uptown"        // "uptown", "downtown", "no_trump"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bid placed: 5 uptown",
  "current_high_bid": {
    "player": "north",
    "amount": 5,
    "type": "uptown"
  }
}
```

#### Play Card
```http
POST /api/bid-whist/play
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "game_id": "bidwhist_abc123",
  "card": {
    "value": "A",
    "suit": "spades"
  }
}
```

---

### Vibez 654 (Dice)

#### Play Dice
```http
POST /api/dice/play
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "bet_amount": 50,
  "side_bets": [
    {"type": "hard_6", "amount": 10},
    {"type": "any_7", "amount": 5}
  ]
}
```

**Response:**
```json
{
  "session_id": "dice_session_xyz",
  "roll": [6, 5, 4],
  "total": 15,
  "state": "STAND",
  "payout": 100,
  "side_bet_results": [
    {"type": "hard_6", "won": false, "payout": 0}
  ]
}
```

---

## 🏰 Premium Features API

### Private Vibe Suites

#### Create Suite
```http
POST /api/vibe-suites/create
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Diamond VIP Lounge",
  "description": "Exclusive high-stakes gaming",
  "access_level": "token_gated",
  "entry_requirement": 500,
  "theme": "gold_rush",
  "max_players": 8,
  "available_games": ["blackjack", "baccarat", "poker"],
  "enable_voice_chat": true,
  "enable_video_chat": false,
  "is_permanent": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "suite_id": "suite_abc123def456",
  "message": "Vibe Suite 'Diamond VIP Lounge' created successfully!",
  "share_url": "/vibe-suites/suite_abc123def456",
  "access_code": "3D456"
}
```

#### Discover Suites
```http
GET /api/vibe-suites/discover?access_level=token_gated&theme=gold_rush&limit=20
```

**Response:**
```json
{
  "success": true,
  "suites": [
    {
      "suite_id": "suite_xyz",
      "name": "Diamond VIP Lounge",
      "owner_name": "HighRoller",
      "access_level": "token_gated",
      "entry_requirement": 500,
      "theme": "gold_rush",
      "current_players": [],
      "max_players": 8,
      "status": "active"
    }
  ],
  "total": 1
}
```

#### Join Suite
```http
POST /api/vibe-suites/join
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "suite_id": "suite_abc123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Welcome to Diamond VIP Lounge!",
  "suite": { /* full suite details */ },
  "access_token": "suite_access_abcdef123456"
}
```

---

## 👑 God Mode Admin API

**Note:** Requires admin email in `ADMIN_EMAILS` environment variable.

### Casino Analytics
```http
GET /api/god-mode/casino-analytics
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "users": {
    "total": 5420,
    "dau": 342,
    "mau": 1850,
    "new_today": 25,
    "dau_mau_ratio": 18.49
  },
  "games": {
    "today": {
      "baccarat": 450,
      "bid_whist": 23,
      "dice_sessions": 180,
      "blackjack": 320
    },
    "total_today": 973
  },
  "revenue": {
    "total_wagered_today": 125000,
    "player_profit_today": -8500,
    "platform_revenue_today": 8500
  },
  "top_players": [
    {
      "user_id": "user_abc",
      "username": "HighRoller99",
      "profit": 15000,
      "games_played": 420,
      "total_wagered": 250000
    }
  ]
}
```

### Active Games
```http
GET /api/god-mode/active-games
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
  "bid_whist": {
    "count": 5,
    "games": [ /* active games */ ]
  },
  "vibe_suites": {
    "count": 12,
    "suites": [ /* active suites */ ]
  },
  "baccarat": {
    "count": 45,
    "recent_games": [ /* last 10 games */ ]
  }
}
```

### Ban User
```http
POST /api/god-mode/users/ban
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_id": "user_troublemaker",
  "reason": "Cheating detected",
  "duration_hours": null      // null = permanent, number = temporary
}
```

**Response:**
```json
{
  "success": true,
  "message": "User permanent banned for: Cheating detected"
}
```

### Suspend User
```http
POST /api/god-mode/users/suspend
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "user_id": "user_spammer",
  "reason": "Spam in chat",
  "duration_hours": 24
}
```

---

## ❌ Error Responses

### 400 Bad Request
```json
{
  "detail": "Insufficient credits"
}
```

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "God Mode access required"
}
```

### 404 Not Found
```json
{
  "detail": "Game not found"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Internal server error"
}
```

---

## 📊 Rate Limits

- **General API:** 100 requests/minute
- **Game endpoints:** 60 requests/minute
- **Admin endpoints:** 200 requests/minute

**Rate limit headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1638360000
```

---

## 🔄 WebSocket Events (Multiplayer)

**Connect:**
```javascript
const socket = io('http://localhost:8001', {
  path: '/api/socket.io',
  transports: ['websocket', 'polling']
});
```

**Events:**
- `game:update` - Game state changed
- `player:joined` - Player joined room
- `player:left` - Player left room
- `bid:placed` - New bid in Bid Whist
- `card:played` - Card played

---

## 📚 Additional Resources

- **Interactive Docs:** http://localhost:8001/docs
- **ReDoc:** http://localhost:8001/redoc
- **GitHub:** [Repository Link]
- **Support:** support@globalvibez.com
