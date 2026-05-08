# Vibe 654 Tournament Mode - API Documentation

## Overview
20-player tournament tables for Vibe 654 dice game. Based on official tournament rules with sequential qualification, elimination rounds, and 12.5% house rake.

## Tournament Flow

### 1. Table Creation
**Host creates a table** with configurable buy-in ($20, $50, $100, etc.)

```bash
POST /api/vibe654/tournament/create-table
{
  "host_user_id": "user123",
  "host_name": "John Doe",
  "buy_in": 50.0,
  "max_players": 20,
  "table_name": "High Rollers Vibe 654"
}

Response:
{
  "success": true,
  "table_id": "uuid-here",
  "message": "Table created! Buy-in: $50. Waiting for players..."
}
```

### 2. Players Join
**Up to 20 players join the table** by paying the buy-in

```bash
POST /api/vibe654/tournament/join-table
{
  "user_id": "player2",
  "player_name": "Jane Smith",
  "table_id": "uuid-here"
}

Response:
{
  "success": true,
  "message": "Jane Smith joined! Pot: $100",
  "players_count": 2,
  "total_pot": 100.0
}
```

### 3. Host Starts Tournament
**Once enough players join**, host starts the tournament

```bash
POST /api/vibe654/tournament/start-tournament/{table_id}?host_user_id=user123

Response:
{
  "success": true,
  "message": "Tournament STARTED! Round 1 begins.",
  "players": [...],
  "total_pot": 1000.0
}
```

### 4. Play Rounds (Orbits)
**Each round**, all active players roll (3 attempts each to qualify)

```bash
POST /api/vibe654/tournament/play-round/{table_id}

Possible Outcomes:

A. WINNER (One player with highest score)
{
  "success": true,
  "outcome": "WINNER",
  "winner": {"user_id": "player5", "player_name": "Winner Name"},
  "final_score": 8,
  "payout": {
    "total_pot": 1000.0,
    "house_rake": 125.0,  # 12.5%
    "winner_payout": 875.0
  }
}

B. TIE (Multiple players tied for highest score)
{
  "success": true,
  "outcome": "TIE",
  "message": "TIE! 3 players advance. $50 re-up. New pot: $1150",
  "winners": [{...}, {...}, {...}],
  "eliminated": [{...}, {...}],
  "new_pot": 1150.0,
  "round_results": {...}
}

C. NO_QUALIFIERS (Nobody qualified - all bust)
{
  "success": true,
  "outcome": "NO_QUALIFIERS",
  "message": "NO QUALIFIERS! Everyone re-ups $50. New pot: $2000",
  "new_pot": 2000.0
}
```

### 5. Get Table Status
**Check current table state** at any time

```bash
GET /api/vibe654/tournament/table/{table_id}

Response:
{
  "success": true,
  "table": {
    "table_id": "uuid",
    "table_name": "High Rollers Vibe 654",
    "buy_in": 50.0,
    "total_pot": 1000.0,
    "status": "IN_PROGRESS",  # WAITING, IN_PROGRESS, COMPLETED
    "round_number": 3,
    "players": [...],
    "active_players": 5,
    "host": "John Doe",
    "winner": null,
    "round_history": [...]
  }
}
```

### 6. View Active Tables
**List available tables** waiting for players

```bash
GET /api/vibe654/tournament/tables/active?limit=10

Response:
{
  "success": true,
  "tables": [
    {
      "table_id": "uuid1",
      "table_name": "High Rollers",
      "buy_in": 50.0,
      "current_players": 12,
      "max_players": 20,
      "total_pot": 600.0,
      "status": "WAITING"
    },
    ...
  ]
}
```

### 7. Player History
**View player's past tournaments**

```bash
GET /api/vibe654/tournament/history/{user_id}?limit=10

Response:
{
  "success": true,
  "history": [
    {
      "table_name": "High Rollers",
      "buy_in": 50.0,
      "total_pot": 1200.0,
      "players_count": 20,
      "winner": "Jane Smith",
      "is_winner": false,
      "payout": 0,
      "completed_at": "2026-04-13T22:30:00Z"
    },
    ...
  ]
}
```

## Game Rules

### Qualification (6-5-4 Sequential)
1. **Start with 5 dice**
2. **3 rolls maximum** per player
3. **Must roll**: 6, then 5, then 4 (in strict order)
4. **Each qualifier removes a die** from the roll
5. **Points**: Sum of remaining 2 dice after qualifying

### Scoring Examples
- Roll 1: [6, 3, 2, 1, 1] → Lock 6, 4 dice left
- Roll 2: [5, 4, 2, 3] → Lock 5, then 4, points = 2+3 = **5 points**

- Roll 1: [6, 5, 4, 3, 2] → Lock all three! Points = 3+2 = **5 points**

- Roll 3: [3, 2, 1] → No 6 → **BUST (0 points)**

### Tournament Mechanics
- **Highest score(s) advance** to next round
- **Ties**: Tied players add buy-in to pot, continue
- **No qualifiers**: Everyone re-ups, pot doubles
- **Winner takes**: Total pot - 12.5% house rake
- **Losers eliminated** after each round

### Example Tournament
```
20 players, $50 buy-in = $1,000 pot

Round 1:
  Player 5: 10 points
  Player 12: 10 points  
  Player 7: 8 points
  Others: 0-7 points
  → Result: TIE! Players 5 & 12 advance, add $50 each
  → New pot: $1,100

Round 2 (Shootout):
  Player 5: 6 points
  Player 12: 9 points
  → Result: WINNER! Player 12 takes pot
  → House rake: $137.50 (12.5%)
  → Player 12 wins: $962.50
```

## MongoDB Collections

### vibe654_tables
```javascript
{
  table_id: "uuid",
  table_name: "High Rollers Vibe 654",
  host_user_id: "user123",
  host_name: "John Doe",
  buy_in: 50.0,
  max_players: 20,
  current_players: [
    {
      user_id: "player1",
      player_name: "Jane",
      status: "active",  // active, eliminated
      joined_at: "ISO timestamp"
    }
  ],
  total_pot: 1000.0,
  status: "IN_PROGRESS",  // WAITING, IN_PROGRESS, COMPLETED
  round_number: 2,
  round_history: [
    {
      round_number: 1,
      outcome: "TIE",
      high_score: 8,
      results: {...},
      timestamp: "ISO"
    }
  ],
  winner: {
    user_id: "player5",
    player_name: "Winner"
  },
  payout_info: {
    total_pot: 1000.0,
    house_rake: 125.0,
    winner_payout: 875.0
  },
  created_at: "ISO timestamp",
  started_at: "ISO timestamp",
  completed_at: "ISO timestamp"
}
```

## Frontend Integration

### Lobby View
1. Display active tables (`GET /tables/active`)
2. Show: Table name, buy-in, players count, pot size
3. "Join Table" button → `POST /join-table`
4. "Create Table" button → `POST /create-table`

### Table View
1. WebSocket connection for real-time updates (optional)
2. Display player list, pot size, round number
3. Host has "Start Tournament" button
4. "Play Round" button (auto or manual)
5. Show round results animation
6. Display winner celebration when tournament ends

### UI Components Needed
- **Tournament Lobby** (list of tables)
- **Table Room** (player list, pot, status)
- **Round Animation** (dice rolls, eliminations)
- **Winner Screen** (payout breakdown)
- **Tournament History** (past results)

## Testing

### Test Full Tournament Flow
```bash
# 1. Create table
curl -X POST $API/api/vibe654/tournament/create-table \
  -H "Content-Type: application/json" \
  -d '{"host_user_id":"demo","host_name":"Demo","buy_in":20,"table_name":"Test Table"}'

# 2. Join 2 players (minimum)
curl -X POST $API/api/vibe654/tournament/join-table \
  -d '{"user_id":"player2","player_name":"P2","table_id":"TABLE_ID"}'

# 3. Start tournament
curl -X POST $API/api/vibe654/tournament/start-tournament/TABLE_ID?host_user_id=demo

# 4. Play rounds until winner
curl -X POST $API/api/vibe654/tournament/play-round/TABLE_ID

# 5. Check final results
curl -X GET $API/api/vibe654/tournament/table/TABLE_ID
```

## Next Steps
1. **Frontend UI** - Create tournament lobby and table views
2. **WebSockets** - Real-time updates for spectators
3. **Animations** - Dice roll animations, elimination effects
4. **Chat** - Table chat for players
5. **Spectator Mode** - Watch tournaments in progress
6. **Tournament Schedule** - Scheduled daily/weekly tournaments
