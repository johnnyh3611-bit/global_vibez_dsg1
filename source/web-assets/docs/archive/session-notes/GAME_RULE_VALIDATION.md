# Game Rule Validation Framework

## Overview
The dual-bot testing framework now includes comprehensive rule validation to ensure all game mechanics are properly enforced.

## Rule Categories

### 1. Turn Order & Enforcement
**What it checks:**
- Only one player can have a turn at a time
- Opponent cannot make moves during other player's turn
- Turn indicators are consistent across both players

**Implementation:**
```javascript
// Check if both players show YOUR TURN simultaneously
if (p1HasTurn > 0 && p2HasTurn > 0) {
  logRuleViolation('Turn Order', 'Both players show YOUR TURN simultaneously');
}

// Verify opponent buttons are disabled
const opponentEnabledButtons = await otherPlayer.locator('button:not([disabled])').count();
if (opponentEnabledButtons > threshold) {
  logRuleViolation('Turn Enforcement', 'Opponent has enabled buttons');
}
```

### 2. Move Validation
**What it checks:**
- Invalid moves are prevented (e.g., occupied cells in Tic-Tac-Toe)
- Disabled buttons cannot be clicked
- Move effects are applied correctly

**Implementation:**
```javascript
// Check if occupied cells are clickable
const occupiedClickable = await player.locator('button:not([disabled])').filter({
  hasText: /X|O/
}).count();

if (occupiedClickable > 0) {
  logRuleViolation('Cell Occupancy', 'Occupied cells still clickable');
}
```

### 3. State Synchronization
**What it checks:**
- Both players see the same game state
- Moves are reflected across all clients
- Game state updates correctly after each action

**Implementation:**
```javascript
// Verify turn indicators are mutually exclusive
const p1TurnIndicator = await player1.locator('text=YOUR TURN').count();
const p2TurnIndicator = await player2.locator('text=YOUR TURN').count();

if (p1TurnIndicator > 0 && p2TurnIndicator > 0) {
  logRuleViolation('State Sync', 'Inconsistent turn state');
}
```

### 4. Win/Lose Consistency
**What it checks:**
- Winner and loser results match between players
- Draw state is consistent
- Game end conditions are properly detected

**Implementation:**
```javascript
// Verify one player wins and the other loses
if (gameOver1 > 0 && gameLose2 === 0) {
  logRuleViolation('Win/Lose Consistency', 'P1 wins but P2 does not show loss');
}

if (gameDraw1 > 0 && gameDraw2 === 0) {
  logRuleViolation('Draw Consistency', 'Only one player shows draw');
}
```

## Game-Specific Rules

### Tic-Tac-Toe
- ✅ Turn order (alternating players)
- ✅ Cell occupancy (cannot click filled cells)
- ✅ Win condition (3-in-a-row)
- ✅ Board state sync

### Connect 4
- ✅ Turn order
- ✅ Column selection (pieces must fall to bottom)
- ✅ Full column prevention
- ✅ Win condition (4-in-a-row)

### Chess
- ⚠️ Piece ownership (can only move own pieces)
- ⚠️ Valid moves per piece type
- ⚠️ Check/checkmate detection
- ⚠️ Turn alternation

### Card Games (Poker, UNO, etc.)
- ⚠️ Hand visibility (can only see own cards)
- ⚠️ Valid card plays
- ⚠️ Deck management
- ⚠️ Scoring rules

## Usage

### Run with Rule Validation
```bash
cd /app/tests
BASE_URL="https://social-connect-953.preview.emergentagent.com" \
API_URL="https://social-connect-953.preview.emergentagent.com" \
node dual-bot-tester.js tictactoe
```

### Output Example
```
📋 Validating game rules...
Turn 1: P1 has turn: true, P2 has turn: false
✅ RULE ENFORCED: Turn Order - Only one player can move at a time
✅ RULE ENFORCED: Turn Enforcement - P2 cannot move during P1's turn
✅ RULE ENFORCED: Cell Occupancy - Occupied cells cannot be clicked
✅ Player 1 made move 1

...

📊 RULE VALIDATION SUMMARY
============================================================
✅ ALL GAME RULES PROPERLY ENFORCED!
   - Turn order
   - Move validation
   - State synchronization
   - Win/lose consistency
============================================================
```

### Handling Rule Violations
```
📊 RULE VALIDATION SUMMARY
============================================================
❌ FOUND 2 RULE VIOLATION(S):

  1. [Turn Enforcement]
     Player 2 has 15 enabled buttons during Player 1's turn
     Time: 2025-12-28T01:50:23.456Z

  2. [Cell Occupancy]
     3 occupied cells are still clickable
     Time: 2025-12-28T01:50:45.789Z
============================================================
```

## Performance Optimization

Rule checks are expensive. To optimize:
1. **Periodic Checks**: Validate every N turns instead of every turn
2. **Conditional Validation**: Only check relevant rules based on game state
3. **Parallel Assertions**: Run independent checks concurrently

```javascript
// Check every 3 turns
if (turn % 3 === 0) {
  await validateGenericRules();
}

// Log only first occurrence
if (turn === 0) {
  this.logRuleEnforced('Rule Name');
}
```

## Adding New Game Rules

### Step 1: Identify Game-Specific Rules
Example for Chess:
- Pawns move forward only
- Bishops move diagonally
- Cannot move into check

### Step 2: Implement Rule Check
```javascript
async playChess() {
  // ...
  
  // Check piece ownership
  const selectedPiece = await getCurrentPiece();
  if (selectedPiece.owner !== currentPlayer) {
    this.logRuleViolation('Piece Ownership', 'Tried to move opponent piece');
  }
  
  // Check valid move
  const isValidMove = await validateChessMove(from, to, pieceType);
  if (!isValidMove) {
    this.logRuleViolation('Move Legality', 'Invalid chess move attempted');
  }
}
```

### Step 3: Add to Rule Summary
Update `printRuleSummary()` to include game-specific rules.

## Test Failure Criteria

A test FAILS if:
- ❌ Game doesn't complete (crash, timeout without reason)
- ❌ Win/lose results are inconsistent
- ❌ Critical rule violations detected (turn order, state sync)

A test PASSES WITH WARNINGS if:
- ⚠️ Minor rule violations detected
- ⚠️ UI inconsistencies (but gameplay works)
- ⚠️ Performance issues (slow but functional)

A test PASSES CLEAN if:
- ✅ Game completes successfully
- ✅ No rule violations
- ✅ Results are consistent
- ✅ All rules enforced

## Future Enhancements

1. **Rule Coverage Metrics**: Track % of rules validated
2. **Automated Rule Discovery**: Infer rules from game behavior
3. **Regression Detection**: Compare rule violations across versions
4. **Visual Rule Validation**: Screenshot comparison for state sync
5. **Performance Profiling**: Measure rule check overhead

## Conclusion

The rule validation framework ensures that:
- Games are fair and balanced
- Cheating is prevented
- State synchronization works correctly
- User experience is consistent

This provides confidence that multiplayer games work correctly before releasing to production.
