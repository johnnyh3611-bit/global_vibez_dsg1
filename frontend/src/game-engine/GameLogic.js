/**
 * GameLogic Base Class
 * Abstract interface that all game-specific logic must implement
 */
export class GameLogic {
  /**
   * Validate if a move is legal
   * @param {Object} state - Current game state
   * @param {Object} action - The action/move to validate
   * @returns {Object} { valid: boolean, reason?: string }
   */
  validateMove(state, action) {
    throw new Error('validateMove() must be implemented by subclass');
  }

  /**
   * Calculate if there's a winner
   * @param {Object} state - Current game state
   * @returns {Object|null} { winner: string, reason: string } or null
   */
  calculateWin(state) {
    throw new Error('calculateWin() must be implemented by subclass');
  }

  /**
   * Get next player/turn
   * @param {Object} state - Current game state
   * @returns {string} Next player ID
   */
  getNextPlayer(state) {
    // Default implementation: toggle between player1 and player2
    return state.current_turn === 'player1' ? 'player2' : 'player1';
  }

  /**
   * Check if game is over (win, draw, timeout)
   * @param {Object} state - Current game state
   * @returns {Object|null} { status: string, winner?: string, reason: string }
   */
  checkGameOver(state) {
    const winResult = this.calculateWin(state);
    if (winResult) {
      return { status: 'completed', ...winResult };
    }
    return null;
  }
}
