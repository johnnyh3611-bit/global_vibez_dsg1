/**
 * Universal Game Engine
 * Handles validation, turn management, and game flow for all multiplayer games
 */
import { SpecificRules } from './SpecificRules';

export class GameEngine {
  /**
   * Universal validation layer
   * @param {Object} gameState - Current game state from server
   * @param {Object} action - The action to validate
   * @returns {Object} { valid: boolean, error?: string }
   */
  static validateAction(gameState, action) {
    // 1. IS IT THEIR TURN? (Universal)
    if (gameState.current_turn !== action.playerId) {
      return { valid: false, error: "Wait for your turn!" };
    }

    // 2. IS THE MOVE DATA VALID? (Universal)
    if (!action.payload) {
      return { valid: false, error: "Invalid move data." };
    }

    // 3. RUN GAME-SPECIFIC RULES
    const gameType = gameState.game_type;
    const gameLogic = SpecificRules[gameType];

    if (!gameLogic) {

      return { valid: true }; // Default to allowing move if no rules defined
    }

    return gameLogic.validateMove(gameState.game_state, action);
  }

  /**
   * Check if game has a winner
   * @param {Object} gameState - Current game state
   * @returns {Object|null} Winner information or null
   */
  static checkWinner(gameState) {
    const gameType = gameState.game_type;
    const gameLogic = SpecificRules[gameType];

    if (!gameLogic) {
      return null;
    }

    return gameLogic.calculateWin(gameState.game_state);
  }

  /**
   * Get next player in turn order
   * @param {Object} gameState - Current game state
   * @returns {string} Next player ID
   */
  static getNextPlayer(gameState) {
    const gameType = gameState.game_type;
    const gameLogic = SpecificRules[gameType];

    if (!gameLogic) {
      // Default toggle
      return gameState.current_turn === 'player1' ? 'player2' : 'player1';
    }

    return gameLogic.getNextPlayer(gameState.game_state);
  }
}
