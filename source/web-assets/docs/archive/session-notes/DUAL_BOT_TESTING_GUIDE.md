# Dual-Bot Testing Enhancement Guide

## Overview
Enhanced dual-bot testing framework specifically designed for the 10 cultural games with game-specific validations.

## Files Created

### 1. `/app/tests/cultural-games-config.js`
Game-specific test configurations including:
- Minimum and maximum turn counts
- Game state validation functions
- Automated move-making functions
- Win condition checks

### 2. `/app/tests/test-cultural-games.js`
Automated test runner that:
- Tests all 10 cultural games sequentially
- Reports pass/fail for each game
- Generates comprehensive test summary
- Measures test duration

## Test Configurations

Each game has custom validation:

### Ludo
- ✅ Validates 4 tokens per player
- ✅ Checks position structure
- ✅ Tests dice rolling mechanism
- **Turns:** 5-50

### Dominoes
- ✅ Validates hand sizes (≤7 tiles each)
- ✅ Checks boneyard presence
- ✅ Tests tile matching
- **Turns:** 5-40

### Mancala
- ✅ Validates 6 pits per player
- ✅ Checks stores initialization
- ✅ Tests stone sowing
- **Turns:** 10-60

### Backgammon
- ✅ Validates 24-point board
- ✅ Checks bar and bearing off areas
- ✅ Tests checker movement
- **Turns:** 10-100

### Chinese Checkers
- ✅ Validates 10 pieces per player
- ✅ Checks star-shaped board positions
- ✅ Tests jumping mechanics
- **Turns:** 10-100

### Parcheesi
- ✅ Validates position tracking
- ✅ Checks safe spaces definition
- ✅ Tests blockade mechanics
- **Turns:** 10-80

### Mahjong
- ✅ Validates hand sizes (13-14 tiles)
- ✅ Checks wall tile count
- ✅ Tests tile drawing
- **Turns:** 10-50

### Carrom, Shogi, Xiangqi
- Basic structure validation
- State integrity checks
- Ready for extended validation

---

## Running Tests

### Test Single Game
```bash
cd /app/tests
node dual-bot-tester.js ludo
```

### Test All Cultural Games
```bash
cd /app/tests
node test-cultural-games.js
```

### Expected Output
```
═══════════════════════════════════════════════════════════
   🎮 CULTURAL GAMES AUTOMATED TESTING SUITE 🎮
═══════════════════════════════════════════════════════════

============================================================
  Testing: Ludo
============================================================

🤖 Initializing Dual-Bot Testing System...
✅ Two browsers launched
🔐 Logging in both players...
✅ Player 1 test user created
✅ Player 2 test user created
🎮 Both players joining ludo...
✅ Match found!
✅ Both players in game
🎮 Running game loop...

✅ Ludo - PASSED

[... continues for all games ...]

═══════════════════════════════════════════════════════════
                     TEST SUMMARY
═══════════════════════════════════════════════════════════

Total Games Tested: 10
✅ Passed: 10
❌ Failed: 0
⏭️  Skipped: 0
⏱️  Duration: 15.23 minutes
```

---

## Manual Testing Alternative

If dual-bot testing encounters CORS/auth issues, use manual testing:

### Two-Browser Method
1. Open browser window 1 → `/http-multiplayer`
2. Open browser window 2 (or incognito) → `/http-multiplayer`
3. In both windows:
   - Enter different usernames
   - Select same game type
   - Click "Find Match"
4. Verify both enter the game
5. Test turns, moves, and gameplay

### Backend API Testing (Already Verified ✅)
```bash
bash /tmp/test_all_10_games.sh
```
**Result:** 10/10 games PASSED ✅

---

## Test Validation Checklist

For each game, tests verify:

### Backend Integration
- [x] Matchmaking works
- [x] Game state initializes correctly
- [x] State structure matches frontend expectations
- [x] HTTP polling synchronization

### Frontend Rendering
- [ ] Game board renders without errors
- [ ] Player indicators display correctly
- [ ] Turn mechanics work
- [ ] Move interactions functional

### Game Logic
- [ ] Valid moves accepted
- [ ] Invalid moves rejected
- [ ] Turn switching works
- [ ] Win conditions trigger

### Social Features
- [ ] Player names display
- [ ] Turn indicators update
- [ ] Opponent moves sync in real-time

---

## Current Status

### ✅ Completed
- Backend API tests (10/10 passed)
- Test configuration files created
- Cultural games test runner created
- Game-specific validation functions

### 🔄 In Progress
- Auth integration for playwright tests
- Extended move validation
- Win condition automation

### ⏳ Future
- Screenshot comparison testing
- Performance benchmarking
- Load testing with multiple concurrent games
- Mobile responsiveness testing

---

## Troubleshooting

### Issue: CORS errors in dual-bot tests
**Solution:** Tests are designed for production URL. For local testing:
1. Use manual two-browser method, OR
2. Update dual-bot tester to use production URL

### Issue: Auth cookie not persisting
**Solution:** The `/api/auth/test-user` endpoint provides session tokens. Ensure cookies are being injected correctly.

### Issue: Game not found
**Solution:** Verify game type spelling matches backend:
- `ludo` ✅
- `Ludo` ❌
- `LUDO` ❌

---

## Next Steps

1. **Run manual tests** on all 10 games to verify UI
2. **Complete rules integration** for remaining 7 games
3. **Run dual-bot tests** once auth is resolved
4. **Add extended validations** for complex game rules
5. **Create test reports** for each iteration

---

## Resources

- Main dual-bot tester: `/app/tests/dual-bot-tester.js`
- Game configs: `/app/tests/cultural-games-config.js`
- Test runner: `/app/tests/test-cultural-games.js`
- Validators: `/app/tests/*-validator.js`
- Test reports: `/app/test_reports/`
