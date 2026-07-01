# 🎮 Universal Game Room - Quick Test Guide

## New Game Routes Available

The Universal Card Game Engine now supports **4 games** via the dynamic route:

```
/game/:gameType/:roomCode
```

---

## 🃏 **Available Games**

### 1. Blackjack (Existing)
**Route:** `/game/blackjack/test-room`  
**Players:** 1-7  
**Status:** ✅ Fully Tested  

### 2. Poker (NEW)
**Route:** `/game/poker/test-room`  
**Players:** 2-10  
**Status:** 🆕 Ready to Test  
**Features:** Texas Hold'em, betting rounds, blinds

### 3. Spades (NEW)
**Route:** `/game/spades/test-room`  
**Players:** 4 (fixed)  
**Status:** 🆕 Ready to Test  
**Features:** Bidding, trick-taking, partnerships

### 4. Rummy (NEW)
**Route:** `/game/rummy/test-room`  
**Players:** 2-6  
**Status:** 🆕 Ready to Test  
**Features:** Gin Rummy, knock, meld validation

---

## 🧪 **Testing Instructions**

### Quick Test Links

```
http://localhost:3000/game/poker/test-poker-001
http://localhost:3000/game/spades/test-spades-001
http://localhost:3000/game/rummy/test-rummy-001
```

### What to Test

**For Each Game:**
1. ✅ Game loads without errors
2. ✅ Plugin metadata displays correctly
3. ✅ Cards deal properly
4. ✅ Game-specific actions appear (bet/bid/draw/discard)
5. ✅ Scoring calculates correctly
6. ✅ Win conditions trigger properly

**Poker-Specific:**
- [ ] Pre-flop, flop, turn, river phases
- [ ] Bet, raise, call, fold buttons
- [ ] Pot calculation
- [ ] All-in functionality

**Spades-Specific:**
- [ ] Bidding phase (0-13 tricks)
- [ ] Trick-taking mechanics
- [ ] Spades trump behavior
- [ ] Partnership scoring

**Rummy-Specific:**
- [ ] Draw from stock/discard pile
- [ ] Discard cards
- [ ] Knock when deadwood ≤ 10
- [ ] Gin bonus (0 deadwood)

---

## 🔧 **How It Works**

The `UniversalGameRoom` component:
1. Reads `gameType` from URL params (`poker`, `spades`, `rummy`)
2. Loads plugin from `PluginRegistry.get(gameType)`
3. Creates `GameEngine` instance with the plugin
4. Renders adaptive UI based on plugin config

**Example:**
```javascript
// URL: /game/poker/room-123
const { gameType, roomCode } = useParams(); // gameType = 'poker'
const plugin = PluginRegistry.get('poker'); // Loads PokerPlugin
const engine = new GameEngine(plugin, roomCode);
```

---

## 📋 **Plugin Registry Status**

Run this in browser console to verify:

```javascript
import { PluginRegistry } from '@/engine/PluginRegistry';

// Get all registered games
console.log(PluginRegistry.getAvailableGames());
// Expected: ['blackjack', 'poker', 'spades', 'rummy']

// Get plugin metadata
console.log(PluginRegistry.getMetadata('poker'));
// Expected: { displayName: 'Texas Hold'em', category: 'casino', ... }
```

---

## 🐛 **Troubleshooting**

### Plugin Not Found Error
```
Error: Game plugin 'poker' not found
```
**Fix:** Verify PluginRegistry.js imports and registers the plugin

### Blank Screen
**Fix:** Check browser console for errors, verify plugin exports correctly

### Actions Not Appearing
**Fix:** Plugin's `getValidActions()` may need debugging

---

## ✅ **Expected Behavior**

### Poker Flow
1. Game loads → Shows poker table
2. Click "START GAME" → Betting modal appears
3. Place bet → Cards dealt (2 hole cards)
4. Actions: Check, Bet, Fold, All-In

### Spades Flow
1. Game loads → Shows 4-player table
2. Click "START GAME" → Bidding phase
3. Each player bids 0-13 tricks
4. Playing phase → Follow suit or play trump

### Rummy Flow
1. Game loads → Shows table with 2-6 players
2. Click "START GAME" → 10 cards dealt
3. Draw from stock/discard pile
4. Discard cards
5. Knock or Gin when ready

---

## 🚀 **Next Steps**

After testing routes:
1. Fix any bugs found in plugins
2. Add AI opponents for multiplayer experience
3. Create lobby system for room creation
4. Add matchmaking for online multiplayer

---

**Status:** Routes Created ✅  
**Ready for Testing:** Yes  
**Documentation:** Complete  
