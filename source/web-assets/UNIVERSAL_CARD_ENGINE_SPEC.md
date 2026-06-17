# Universal Card Game Engine - Architecture Specification
## The Foundation for Infinite Card Games

**Version**: 1.0  
**Date**: April 17, 2026  
**Architect**: Universal Card Game Architect (UCGA)

---

## 🎯 CORE PHILOSOPHY

**Problem**: Each game (Poker, Blackjack, UNO, Spades) has its own hardcoded logic, creating:
- Code duplication (~300 lines per game)
- Maintenance burden (bug fix × N games)
- Routing conflicts (7+ Bid Whist components)
- Impossible to add new games without full rewrites

**Solution**: **Core + Plugin Architecture**
- **Core Engine**: Handles universal mechanics (never changes)
- **Game Plugins**: Individual rulesets (swappable)
- **Smart Room**: Adaptive UI (2-10 players)

---

## 📐 TASK 1: THE UNIVERSAL GAME STATE SCHEMA

### The Single Source of Truth

Every card game—from Texas Hold'em to Solitaire—can be represented by this unified data structure:

```javascript
{
  // === GAME METADATA ===
  "game_id": "uuid-v4",
  "game_type": "poker" | "blackjack" | "spades" | "solitaire" | "custom_tcg",
  "plugin_version": "1.0.0",
  "created_at": "ISO-8601",
  "status": "waiting" | "active" | "paused" | "completed",
  
  // === ROOM CONFIGURATION ===
  "room": {
    "room_code": "ABCD1234",
    "max_players": 6,
    "min_players": 2,
    "current_player_count": 4,
    "layout_type": "circular" | "hexagonal" | "face_to_face" | "solitaire",
    "seats": [
      {
        "seat_index": 0,
        "player_id": "user_uuid",
        "player_name": "Alice",
        "socket_id": "socket_abc",
        "position": { "angle": 0, "radius": 1 },  // For UI positioning
        "is_active": true,
        "is_dealer": false,
        "is_current_turn": false,
        "state": "playing" | "folded" | "busted" | "waiting"
      }
      // ... up to 10 seats
    ],
    "dealer_position": 0,  // Which seat index is dealer (rotates)
    "spectators": []
  },
  
  // === DECK SYSTEM (Universal) ===
  "deck": {
    "type": "standard_52" | "jokers_54" | "uno" | "custom",
    "cards": [
      {
        "id": "card_uuid",
        "suit": "hearts" | "diamonds" | "clubs" | "spades" | null,
        "rank": "A" | "2"..."K" | "joker" | "wild" | custom,
        "value": 11,  // Numeric value (plugin-defined)
        "color": "red" | "black" | "blue" | "yellow",
        "face_state": "up" | "down",
        "location": "deck" | "hand" | "table" | "discard",
        "owner": "player_uuid" | null
      }
    ],
    "shuffle_algorithm": "fisher_yates",
    "cards_remaining": 32,
    "discard_pile": []
  },
  
  // === GAME STATE (Plugin-Agnostic) ===
  "game_state": {
    // Turn Management
    "turn": {
      "current_turn_index": 0,
      "turn_order": [0, 1, 2, 3],  // Seat indices
      "turn_direction": "clockwise" | "counter_clockwise",
      "turn_timer": 30,  // seconds
      "actions_taken_this_turn": []
    },
    
    // Phase System (Universal State Machine)
    "phase": {
      "current": "betting" | "dealing" | "playing" | "showdown" | "scoring",
      "phase_history": ["ante", "deal", "betting_round_1"],
      "valid_actions": ["fold", "call", "raise", "check"]
    },
    
    // Pot/Betting System (for games with betting)
    "pot": {
      "total": 500,
      "side_pots": [],
      "current_bet": 50,
      "min_bet": 10,
      "players_in_pot": ["player_1", "player_2"]
    },
    
    // Trick System (for trick-taking games)
    "trick": {
      "current_trick": 1,
      "total_tricks": 13,
      "cards_played_this_trick": [
        { "player_id": "p1", "card_id": "card_1" }
      ],
      "trick_winner": null,
      "tricks_won": { "player_1": 3, "player_2": 2 }
    },
    
    // Score System (universal)
    "score": {
      "type": "points" | "chips" | "tricks" | "lives",
      "players": {
        "player_1": { "current": 1500, "starting": 1000, "delta": +500 },
        "player_2": { "current": 800, "starting": 1000, "delta": -200 }
      },
      "win_condition": { "type": "highest_score" | "reach_target" | "last_standing", "target": 2000 }
    }
  },
  
  // === PLAYER HANDS (Universal Container) ===
  "hands": {
    "player_1": {
      "cards": ["card_uuid_1", "card_uuid_2"],
      "card_count": 2,
      "hand_value": 21,  // Plugin calculates (Blackjack = 21, Poker = pair of aces)
      "hand_rank": "pair",  // Plugin-defined ranking
      "visible_to": ["player_1", "dealer"]  // Visibility control
    }
  },
  
  // === COMMUNITY/TABLE CARDS (for games like Hold'em) ===
  "table_cards": {
    "community": ["card_1", "card_2", "card_3"],  // Flop, turn, river
    "visible_to": "all",
    "layout": "linear" | "circular" | "stacked"
  },
  
  // === GAME-SPECIFIC PLUGIN DATA ===
  "plugin_data": {
    // This is where game-specific rules store their unique data
    // Poker might store: { "small_blind": 10, "big_blind": 20, "betting_round": 2 }
    // UNO might store: { "draw_stack": 0, "uno_called": false }
    // Bid Whist might store: { "bid_amount": 5, "trump_suit": "spades" }
    // This keeps core clean while allowing infinite flexibility
  },
  
  // === ACTIONS LOG (Audit Trail) ===
  "action_history": [
    {
      "timestamp": "ISO-8601",
      "player_id": "p1",
      "action_type": "bet" | "fold" | "play_card" | "draw",
      "action_data": { "amount": 50, "card": "A♠" },
      "result": "success" | "invalid"
    }
  ],
  
  // === METADATA ===
  "settings": {
    "allow_spectators": true,
    "allow_chat": true,
    "auto_deal": true,
    "animation_speed": "normal",
    "language": "en"
  }
}
```

---

## 🔧 TASK 2: THE LOGIC GUARDRAIL - Preventing Double Logic

### The Clutter-Free Protocol

**Problem Identified**: 
When you have 10, 20, 100 games, without guardrails you get:
- ❌ `PokerGame.jsx`, `PokerPremium.jsx`, `PokerMultiplayer.jsx` (3 files for 1 game)
- ❌ Duplicate shuffle logic in every game
- ❌ Betting logic copy-pasted 8 times
- ❌ Different error handling per game

**Solution**: **Atomic Rule Library + Plugin System**

### Architecture: Core + Plugin + Renderer

```
┌─────────────────────────────────────────────────┐
│          CORE ENGINE (Never Changes)            │
│  - Deck Management (shuffle, deal, draw)       │
│  - Player Management (join, leave, turn order) │
│  - Room Management (create, destroy, sync)     │
│  - Animation System (card flip, slide, glow)   │
│  - State Synchronization (Socket.IO)           │
└─────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│         PLUGIN REGISTRY (Swappable)             │
│                                                 │
│  PokerPlugin.js     BlackjackPlugin.js         │
│  UNOPlugin.js       SpadesPlugin.js            │
│  CustomTCGPlugin.js  RummyPlugin.js            │
│                                                 │
│  Each plugin exports:                          │
│  - validateAction(state, action)               │
│  - calculateScore(hand)                        │
│  - determineWinner(state)                      │
│  - getValidActions(state, player)              │
└─────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────┐
│      UNIVERSAL RENDERER (Adaptive UI)           │
│  - Smart Room Layout (2-10 players)            │
│  - Card Animation Layer                        │
│  - Action Button Generator                     │
│  - Score Display System                        │
└─────────────────────────────────────────────────┘
```

### The Guardrail Rules

#### Rule 1: Single Responsibility Principle
**One file, one job, forever.**

```javascript
// ❌ WRONG: Game logic mixed with UI
function PokerGame() {
  const [deck, setDeck] = useState([]);
  const shuffleDeck = () => { /* 20 lines of shuffle */ };
  const dealCards = () => { /* 30 lines of dealing */ };
  // ... 300 more lines
}

// ✅ CORRECT: Separation of concerns
import { useGameEngine } from '@/hooks/useGameEngine';
import { PokerPlugin } from '@/plugins/PokerPlugin';

function PokerGame() {
  const { state, actions } = useGameEngine(PokerPlugin);
  return <UniversalGameRoom state={state} actions={actions} />;
}
```

#### Rule 2: Atomic Rule Library
**Never duplicate mechanical logic.**

```javascript
// /engine/mechanics/DeckMechanics.js (Used by ALL games)
export const DeckMechanics = {
  shuffle: (cards) => fisherYatesShuffle(cards),
  deal: (deck, playerCount, cardsPerPlayer) => { /* universal */ },
  draw: (deck, count = 1) => deck.splice(0, count),
  discard: (card, discardPile) => discardPile.push(card)
};

// /engine/mechanics/TurnMechanics.js (Used by ALL games)
export const TurnMechanics = {
  nextTurn: (currentIndex, playerCount, direction = 'clockwise') => { /* universal */ },
  skipTurn: (state) => { /* universal */ },
  reverseTurn: (state) => { /* universal */ }
};

// /engine/mechanics/BettingMechanics.js (Used by betting games)
export const BettingMechanics = {
  placeBet: (player, amount, pot) => { /* universal */ },
  calculatePot: (players) => { /* universal */ },
  distributePot: (winners, pot) => { /* universal */ }
};
```

#### Rule 3: Plugin Validation
**Every plugin must implement the same interface.**

```javascript
// /engine/PluginInterface.js
export class GamePlugin {
  // Required methods (throws error if not implemented)
  validateAction(state, playerId, action) { 
    throw new Error('Must implement validateAction'); 
  }
  
  calculateScore(hand) { 
    throw new Error('Must implement calculateScore'); 
  }
  
  determineWinner(state) { 
    throw new Error('Must implement determineWinner'); 
  }
  
  getValidActions(state, playerId) { 
    throw new Error('Must implement getValidActions'); 
  }
  
  // Optional methods (have defaults)
  onGameStart(state) { return state; }
  onGameEnd(state) { return state; }
  onPlayerJoin(state, player) { return state; }
}

// /plugins/PokerPlugin.js
import { GamePlugin } from '@/engine/PluginInterface';
import { BettingMechanics } from '@/engine/mechanics/BettingMechanics';

export class PokerPlugin extends GamePlugin {
  validateAction(state, playerId, action) {
    if (action.type === 'bet') {
      return action.amount >= state.pot.min_bet;
    }
    // ... Poker-specific rules
  }
  
  calculateScore(hand) {
    // Poker hand ranking logic
    return { rank: 'pair', value: 14 };
  }
  
  // ... other required methods
}
```

#### Rule 4: Registry Pattern
**One central plugin registry. Zero routing chaos.**

```javascript
// /engine/PluginRegistry.js
import { PokerPlugin } from '@/plugins/PokerPlugin';
import { BlackjackPlugin } from '@/plugins/BlackjackPlugin';
import { UNOPlugin } from '@/plugins/UNOPlugin';
import { SpadesPlugin } from '@/plugins/SpadesPlugin';

export const PluginRegistry = {
  'poker': new PokerPlugin(),
  'blackjack': new BlackjackPlugin(),
  'uno': new UNOPlugin(),
  'spades': new SpadesPlugin(),
  // Adding 20th game? Just add one line:
  // 'rummy': new RummyPlugin(),
};

// Usage in frontend:
const gameType = 'poker'; // from URL or user selection
const plugin = PluginRegistry[gameType];
const engine = useGameEngine(plugin);
```

#### Rule 5: File Structure Discipline
**Strict folder hierarchy prevents clutter.**

```
/app/frontend/src/
├── engine/
│   ├── core/
│   │   ├── GameEngine.js          ← The brain (never changes)
│   │   ├── StateManager.js         ← Universal state
│   │   └── PluginInterface.js      ← Plugin contract
│   ├── mechanics/
│   │   ├── DeckMechanics.js        ← Atomic: shuffle, deal, draw
│   │   ├── TurnMechanics.js        ← Atomic: turn order, skip
│   │   ├── BettingMechanics.js     ← Atomic: bet, raise, fold
│   │   └── TrickMechanics.js       ← Atomic: trick-taking
│   └── PluginRegistry.js           ← Central plugin index
├── plugins/
│   ├── PokerPlugin.js              ← Poker rules ONLY
│   ├── BlackjackPlugin.js          ← Blackjack rules ONLY
│   ├── UNOPlugin.js                ← UNO rules ONLY
│   └── CustomTCGPlugin.js          ← User-created games
├── components/
│   ├── UniversalGameRoom.jsx       ← The single game UI
│   ├── SmartRoomLayout.jsx         ← Adaptive 2-10 player layout
│   └── CardAnimationLayer.jsx      ← Visual effects
├── hooks/
│   └── useGameEngine.js            ← Hook to use engine + plugin
└── routes/
    └── UniversalGameRoute.jsx      ← Single route: /game/:gameType/:roomCode
```

---

## 🎨 THE SMART ROOM LAYOUT SYSTEM

### Adaptive UI Based on Player Count

```javascript
// /components/SmartRoomLayout.jsx
export const SmartRoomLayout = ({ playerCount, seats }) => {
  const layouts = {
    1: 'solitaire',      // Center deck, no seats
    2: 'face_to_face',   // Top vs Bottom
    3: 'triangle',       // Equilateral triangle
    4: 'square',         // 4 corners
    5: 'pentagon',       // Pentagon
    6: 'hexagonal',      // Hexagon (most common)
    7: 'heptagon',       // 7-sided
    8: 'octagon',        // 8-sided
    9: 'nonagon',        // 9-sided
    10: 'decagon'        // 10-sided
  };
  
  const layout = layouts[playerCount];
  
  // Calculate seat positions
  const positions = seats.map((seat, index) => {
    const angle = (360 / playerCount) * index;
    const radius = playerCount <= 4 ? 200 : 300; // px
    
    return {
      x: Math.cos(angle * Math.PI / 180) * radius,
      y: Math.sin(angle * Math.PI / 180) * radius,
      rotation: angle + 90 // Cards face center
    };
  });
  
  return (
    <div className="game-table">
      {seats.map((seat, i) => (
        <PlayerSeat
          key={seat.seat_index}
          position={positions[i]}
          player={seat}
          isMyTurn={seat.is_current_turn}
        />
      ))}
      
      <CenterDeck layout={layout} />
    </div>
  );
};
```

---

## 🚀 CLUTTER PREVENTION CHECKLIST

Before adding ANY new game, enforce these rules:

✅ **Does this game use existing mechanics?**  
   → Use `DeckMechanics`, `TurnMechanics`, `BettingMechanics`

✅ **Is this a new Plugin, not a new Component?**  
   → Add to `/plugins/`, NOT `/pages/games/`

✅ **Does it implement the GamePlugin interface?**  
   → All 4 required methods implemented

✅ **Is it registered in ONE place?**  
   → Added to `PluginRegistry.js` only

✅ **Does it reuse UniversalGameRoom?**  
   → NO custom UI per game

✅ **Does it use the Universal Game State?**  
   → Follows schema exactly

✅ **Is routing unified?**  
   → Uses `/game/:gameType/:roomCode` (one route)

---

## 📊 BEFORE & AFTER COMPARISON

### Current Architecture (Clutter)
```
PokerGame.jsx            (500 lines, shuffle + UI + logic)
PokerPremium.jsx         (520 lines, duplicate shuffle)
BlackjackGame.jsx        (480 lines, duplicate shuffle)
UNOGame.jsx              (450 lines, duplicate turn logic)
SpadesGame.jsx           (500 lines, duplicate trick logic)

Total: 2,450 lines, ~1,200 lines duplicated
Routes: 15+ routes (conflicts)
```

### Universal Architecture (Clean)
```
GameEngine.js            (300 lines, universal)
DeckMechanics.js         (100 lines, used by all)
TurnMechanics.js         (80 lines, used by all)
BettingMechanics.js      (120 lines, used by betting games)

PokerPlugin.js           (150 lines, rules only)
BlackjackPlugin.js       (120 lines, rules only)
UNOPlugin.js             (130 lines, rules only)
SpadesPlugin.js          (140 lines, rules only)

UniversalGameRoom.jsx    (200 lines, one UI for all)

Total: 1,340 lines, ZERO duplication
Routes: 1 route (no conflicts)
Adding 10th game: +150 lines (plugin only)
```

**Code Reduction**: ~45%  
**Maintenance**: Fix once, applies to all games  
**Scalability**: Infinite games possible

---

## 🎯 NEXT IMPLEMENTATION STEPS

1. **Create Engine Core** (`/engine/core/GameEngine.js`)
2. **Extract Atomic Mechanics** (`/engine/mechanics/*.js`)
3. **Build Plugin Interface** (`/engine/PluginInterface.js`)
4. **Migrate ONE game to plugin** (Start with simplest: Blackjack)
5. **Build UniversalGameRoom** (Adaptive UI)
6. **Test & Iterate**
7. **Migrate remaining games**
8. **Archive old implementations**

---

**This schema eliminates clutter BEFORE it starts by enforcing architectural discipline from day one.**

**Status**: Foundation specification complete. Ready for implementation phase.
