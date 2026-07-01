/**
 * TurnMechanics.js - Universal Turn Management
 * 
 * Atomic mechanics for turn-based gameplay.
 * Used by ALL turn-based card games.
 * 
 * Operations:
 * - Next turn (clockwise/counter-clockwise)
 * - Skip turn
 * - Reverse turn order
 * - Set turn timer
 * - Validate turn
 */

export const TurnMechanics = {
  /**
   * Calculate next turn index
   */
  nextTurn(currentIndex, playerCount, direction = 'clockwise') {
    if (direction === 'clockwise') {
      return (currentIndex + 1) % playerCount;
    } else {
      return (currentIndex - 1 + playerCount) % playerCount;
    }
  },
  
  /**
   * Skip to specific player
   */
  skipToPlayer(targetIndex, playerCount) {
    return targetIndex % playerCount;
  },
  
  /**
   * Reverse turn direction
   */
  reverseDirection(currentDirection) {
    return currentDirection === 'clockwise' ? 'counter_clockwise' : 'clockwise';
  },
  
  /**
   * Get player at offset from current
   */
  getPlayerAtOffset(currentIndex, offset, playerCount, direction = 'clockwise') {
    const step = direction === 'clockwise' ? offset : -offset;
    return (currentIndex + step + playerCount) % playerCount;
  },
  
  /**
   * Check if it's a specific player's turn
   */
  isPlayerTurn(playerId, state) {
    const currentTurnIndex = state.game_state.turn.current_turn_index;
    const turnOrder = state.game_state.turn.turn_order;
    const currentSeat = state.room.seats[turnOrder[currentTurnIndex]];
    
    return currentSeat && currentSeat.player_id === playerId;
  },
  
  /**
   * Get remaining time for current turn
   */
  getRemainingTime(turnStartTime, turnTimer) {
    const elapsed = Date.now() - turnStartTime;
    const remaining = (turnTimer * 1000) - elapsed;
    return Math.max(0, Math.floor(remaining / 1000));
  },
  
  /**
   * Create turn order from seat indices
   */
  createTurnOrder(seats, startIndex = 0) {
    const seatIndices = seats.map(s => s.seat_index);
    const reordered = [
      ...seatIndices.slice(startIndex),
      ...seatIndices.slice(0, startIndex)
    ];
    return reordered;
  },
  
  /**
   * Rotate dealer position
   */
  rotateDealerPosition(currentDealerIndex, playerCount) {
    return (currentDealerIndex + 1) % playerCount;
  }
};

export default TurnMechanics;
