# UE5 MetaHuman Integration - Quick Start

## ✅ Implemented Components

### Backend (FastAPI)
- ✅ `/app/backend/routes/tournament.py` - Tournament WebSocket server
- ✅ `TournamentTable` class - Multi-table management
- ✅ `TournamentManager` - Global table coordinator
- ✅ WebSocket endpoint: `/ws/tournament/{table_id}`
- ✅ REST endpoints:
  - GET `/api/tournament/tables` - List active tables
  - GET `/api/tournament/{table_id}/state` - Get table state
  - POST `/api/tournament/{table_id}/trigger-event` - Manual event triggers

### Frontend (React)
- ✅ `/app/frontend/src/components/tournament/IntegrityHUD.jsx` - SHA-256 hash overlay
- ✅ `/app/frontend/src/components/tournament/SocialTicker.jsx` - Live bid/comment feed
- ✅ `/app/frontend/src/components/tournament/GiftEffectTrigger.jsx` - Niagara particle sync
- ✅ `/app/frontend/src/pages/TournamentDemo.jsx` - Demo page

### Documentation
- ✅ `/app/UE5_METAHUMAN_INTEGRATION.md` - Complete C++ integration guide

---

## 🚀 Quick Test

### 1. View Demo Page
```
http://localhost:3000/tournament-demo
```

### 2. Test WebSocket Connection (from browser console)
```javascript
const ws = new WebSocket('ws://localhost:8001/api/ws/tournament/test_table');
ws.onmessage = (event) => console.log(JSON.parse(event.data));
ws.send(JSON.stringify({
  type: 'PLAYER_ACTION',
  data: {
    player_id: 'test_001',
    player_name: 'Alex',
    action_type: 'BID',
    value: 10
  }
}));
```

### 3. Trigger Dealer Events via API
```bash
curl -X POST "http://localhost:8001/api/tournament/glasshouse_01/trigger-event?event_type=TEN_FOR_200&player_name=TestPlayer"
```

---

## 🎮 Dealer Event Types

| Event | Animation Tag | Description |
|-------|--------------|-------------|
| `TEN_FOR_200` | `MT_10_for_200_Excited` | 10-for-200 bid reaction |
| `RENEGUE` | `MT_Renegue_Penalty` | Renegue violation |
| `BLIND_NIL` | `MT_BlindNil_Impressed` | Blind Nil bid |
| `JACKPOT` | `MT_Jackpot_Celebration` | Jackpot win |
| `GREETING` | `MT_Welcoming_Gesture` | Player welcome |

---

## 📡 WebSocket Message Format

### Backend → UE5
```json
{
  "type": "DEALER_EVENT",
  "data": {
    "action": "TEN_FOR_200",
    "animation": "MT_10_for_200_Excited",
    "speech": "Ten tricks? The big two-hundred is on the line.",
    "vibe": "Intense",
    "facial_expression": "serious_focus",
    "intensity": 1.0,
    "delay_ms": 1800
  }
}
```

### UE5 → Backend
```json
{
  "type": "PLAYER_ACTION",
  "data": {
    "player_id": "player_001",
    "player_name": "Alex",
    "action_type": "BID",
    "value": 10
  }
}
```

---

## 🛠️ Next Steps for UE5 Integration

1. **Create UE5 Project**
   - Add WebSocketsModule dependency
   - Create ADealerAIController C++ class

2. **Import MetaHuman**
   - Download MetaHuman from Quixel Bridge
   - Set up skeletal mesh in DealerAIController

3. **Create Animation Montages**
   - Record Live Capture performances
   - Map montages to animation tags

4. **Configure WebSocket**
   - Update WebSocket URL in DealerAIController.cpp
   - Test connection to `/ws/tournament/{table_id}`

5. **Test Integration**
   - Send player action from UE5
   - Verify dealer response triggers correctly

---

## 📞 Support

- **Full Integration Guide**: `/app/UE5_METAHUMAN_INTEGRATION.md`
- **Demo Page**: http://localhost:3000/tournament-demo
- **Backend Logs**: `/var/log/supervisor/backend.*.log`

---

**Status**: ✅ Backend & React overlays ready for UE5 connection!
