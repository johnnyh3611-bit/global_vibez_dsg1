# Multiplayer Celestial Slots - Feature Documentation

## Overview
Real-time multiplayer slots with shared jackpots and team bonuses. Players join rooms and spin together, contributing to a progressive jackpot pool.

## Features

### 1. **Shared Jackpot Pool**
- Every spin contributes 10% of the bet to the room's progressive jackpot
- Jackpot starts at $5,000 and grows with each player spin
- Win the jackpot by landing 5 Celestial Crown symbols (👑)
- Jackpot resets to $5,000 after a win

### 2. **Team Bonuses**
- More players in the room = higher multipliers
- **2 players**: 1.1x multiplier
- **3+ players**: 1.2x multiplier
- **5+ players**: 1.3x multiplier

### 3. **Real-Time Updates**
- Live player count
- Instant jackpot pool updates
- Recent spins feed showing other players' wins
- Celebratory animations when someone wins jackpot

### 4. **Three Room Types**

#### Cosmic Lounge
- **Min Bet**: $10
- **Max Bet**: $100
- **Max Players**: 10
- Best for casual players

#### High Rollers VIP
- **Min Bet**: $100
- **Max Bet**: $1,000
- **Max Players**: 6
- Exclusive room for high-stakes players

#### Dating Bonus Special
- **Min Bet**: $25
- **Max Bet**: $250
- **Max Players**: 8
- Enhanced dating bonuses and social features

## Technical Implementation

### Backend
- **File**: `/app/backend/routes/multiplayer_slots.py`
- **HTTP Endpoints**:
  - `GET /api/multiplayer-slots/rooms` - List available rooms
  - `POST /api/multiplayer-slots/spin` - Execute a spin
- **WebSocket**: `/api/ws/multiplayer-slots/{room_id}`
  - Real-time player join/leave events
  - Live spin broadcasts
  - Jackpot updates

### Frontend
- **Component**: `/app/frontend/src/components/practice_games/MultiplayerCelestialSlots.jsx`
- **Route**: `/multiplayer-slots`
- **Features**:
  - Room selection lobby
  - Live spinning animation
  - Recent spins feed
  - Real-time jackpot tracker

## How to Play

1. **Select a Room**: Choose from 3 available rooms based on your budget
2. **Place Your Bet**: Select bet amount (within room limits)
3. **Spin**: Click SPIN button (10% goes to jackpot pool)
4. **Win**: Match 3+ symbols for payouts
5. **Jackpot**: Land 5 👑 symbols to win the entire jackpot!

## Symbol Payouts
- **👑 Celestial Crown**: 500x (Jackpot symbol)
- **💝 Heart Vibe**: 100x (Dating bonus trigger)
- **🎲 Dice Pair**: 50x
- **📺 Live Stream**: 25x
- **⭐ Star**: 15x
- **🍒 Cherry**: 10x
- **💎 Midnight Wild**: Substitutes any symbol

## Team Bonus Calculation
```python
if team_members >= 5:
    multiplier = 1.3
elif team_members >= 3:
    multiplier = 1.2
elif team_members >= 2:
    multiplier = 1.1
else:
    multiplier = 1.0
```

## API Examples

### Get Available Rooms
```bash
curl -X GET https://your-api.com/api/multiplayer-slots/rooms
```

### Execute a Spin
```bash
curl -X POST https://your-api.com/api/multiplayer-slots/spin \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "player123",
    "username": "John",
    "room_id": "cosmic_lounge",
    "bet_amount": 50
  }'
```

## WebSocket Events

### Client → Server
```json
{
  "type": "join",
  "user_id": "player123",
  "username": "John"
}
```

### Server → Client
```json
{
  "type": "player_spin",
  "data": {
    "username": "John",
    "symbols": ["CHERRY", "STAR", "CHERRY", "STAR", "CHERRY"],
    "final_payout": 100,
    "is_jackpot": false,
    "jackpot_pool_after": 5500
  }
}
```

## Testing
Run backend tests:
```bash
cd /app/backend
pytest tests/test_multiplayer_slots.py -v
```

## Future Enhancements
- [ ] Tournament mode with leaderboards
- [ ] Private rooms for friends
- [ ] Special event jackpots
- [ ] Team chat functionality
- [ ] Daily/weekly challenges
