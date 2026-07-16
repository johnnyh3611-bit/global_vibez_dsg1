# Component Refactoring Plan

## Large Components Requiring Splitting

### 1. BlackjackGameSimple.jsx (779 lines)
**Current:** Monolithic game component  
**Target:** 5 smaller components

**Split Plan:**
- `BlackjackGame.jsx` (150 lines) - Main container
- `BlackjackTable.jsx` (100 lines) - Table UI
- `BlackjackHand.jsx` (80 lines) - Hand display
- `BlackjackControls.jsx` (120 lines) - Bet/Hit/Stand controls
- `BlackjackDealer.jsx` (100 lines) - Dealer logic
- `useBlackjackGame.js` (150 lines) - Game logic hook

**Benefits:**
- Easier testing
- Better performance (selective re-renders)
- Improved maintainability

### 2. HumanHolographicDealer.jsx (505 lines)
**Current:** Monolithic dealer component  
**Target:** 4 smaller components

**Split Plan:**
- `DealerContainer.jsx` (120 lines) - Main wrapper
- `DealerAnimations.jsx` (150 lines) - Animation system
- `DealerDialogue.jsx` (100 lines) - Speech system
- `DealerMood.jsx` (80 lines) - Mood/personality state
- `useDealerBehavior.js` (100 lines) - Behavior hook

### 3. CinematicCelebration.jsx (455 lines, complexity 33)
**Current:** Complex celebration effects  
**Target:** 3 smaller components

**Split Plan:**
- `CelebrationContainer.jsx` (100 lines)
- `ParticleEffects.jsx` (150 lines)
- `AnimationSequence.jsx` (120 lines)
- `useCelebrationTrigger.js` (85 lines)

### 4. Python: ai_practice.py
**Current:** minimax_tictactoe() - complexity 27  
**Target:** Extract helper functions

**Split Plan:**
```python
# Current (in one function)
def minimax_tictactoe(board, depth, is_maximizing):
    # 150 lines of complex logic

# Split into:
def evaluate_board_state(board) -> int: ...
def get_possible_moves(board) -> List[tuple]: ...
def apply_move(board, move, player) -> Board: ...
def minimax_tictactoe(board, depth, is_maximizing) -> int:
    # Now only 40 lines, calls helpers
```

## Implementation Priority

1. **Sprint 2:** BlackjackGameSimple (highest impact)
2. **Sprint 3:** HumanHolographicDealer
3. **Sprint 4:** CinematicCelebration
4. **Sprint 5:** Python AI functions

## Success Metrics
- Component lines: < 200 per file
- Function complexity: < 10
- Test coverage: > 80%
