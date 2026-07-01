/**
 * PluginInterface.js - Game Plugin Contract
 * 
 * Every game plugin MUST extend this class and implement all required methods.
 * This enforces consistency and prevents clutter.
 * 
 * Required Methods (will throw error if not implemented):
 * - validateAction()
 * - executeAction()
 * - calculateScore()
 * - determineWinner()
 * - getValidActions()
 * 
 * Optional Methods (have default implementations):
 * - onGameStart()
 * - onGameEnd()
 * - onPlayerJoin()
 * - onPlayerLeave()
 * - onTurnChange()
 * - checkWinCondition()
 * - getInitialPluginData()
 */

export class GamePlugin {
  constructor(config = {}) {
    this.gameType = config.gameType || 'unknown';
    this.version = config.version || '1.0.0';
    this.displayName = config.displayName || this.gameType;
    
    // Game configuration
    this.minPlayers = config.minPlayers || 2;
    this.maxPlayers = config.maxPlayers || 6;
    this.deckType = config.deckType || 'standard_52';
    this.hasBetting = config.hasBetting || false;
    this.hasTricks = config.hasTricks || false;
    this.turnTimer = config.turnTimer || 30;
    this.autoDeal = config.autoDeal || false;
    
    // Betting config
    if (this.hasBetting) {
      this.minBet = config.minBet || 10;
      this.startingChips = config.startingChips || 1000;
      this.smallBlind = config.smallBlind || 5;
      this.bigBlind = config.bigBlind || 10;
    }
    
    // Trick-taking config
    if (this.hasTricks) {
      this.totalTricks = config.totalTricks || 13;
      this.hasTrump = config.hasTrump || false;
      this.hasBidding = config.hasBidding || false;
    }
    
    // Scoring config
    this.scoreType = config.scoreType || 'points';
    this.startingScore = config.startingScore || 0;
    this.winCondition = config.winCondition || { type: 'highest_score', target: 1000 };
  }
  
  // === REQUIRED METHODS ===
  
  /**
   * Validate if an action is legal in current game state
   * @param {Object} state - Current game state
   * @param {String} playerId - Player attempting action
   * @param {Object} action - Action being attempted
   * @returns {Boolean} - True if action is valid
   */
  validateAction(state, playerId, action) {
    throw new Error(`${this.gameType} plugin must implement validateAction()`);
  }
  
  /**
   * Execute an action and return updated game state
   * @param {Object} state - Current game state
   * @param {String} playerId - Player performing action
   * @param {Object} action - Action to execute
   * @returns {Object} - Updated game state
   */
  executeAction(state, playerId, action) {
    throw new Error(`${this.gameType} plugin must implement executeAction()`);
  }
  
  /**
   * Calculate score/value for a player's hand
   * @param {Array} hand - Player's cards
   * @returns {Object} - {value: Number, rank: String, description: String}
   */
  calculateScore(hand) {
    throw new Error(`${this.gameType} plugin must implement calculateScore()`);
  }
  
  /**
   * Determine winner(s) from current game state
   * @param {Object} state - Current game state
   * @returns {Object} - {winnerId, winType, details}
   */
  determineWinner(state) {
    throw new Error(`${this.gameType} plugin must implement determineWinner()`);
  }
  
  /**
   * Get list of valid actions for a player
   * @param {Object} state - Current game state
   * @param {String} playerId - Player to get actions for
   * @returns {Array} - [{type: 'bet', ...}, {type: 'fold', ...}]
   */
  getValidActions(state, playerId) {
    throw new Error(`${this.gameType} plugin must implement getValidActions()`);
  }
  
  // === OPTIONAL METHODS (with default implementations) ===
  
  /**
   * Called when game starts
   */
  onGameStart(state) {
    return state;
  }
  
  /**
   * Called when game ends
   */
  onGameEnd(state, winner) {
    return state;
  }
  
  /**
   * Called when player joins
   */
  onPlayerJoin(state, player) {
    return state;
  }
  
  /**
   * Called when player leaves
   */
  onPlayerLeave(state, playerId) {
    return state;
  }
  
  /**
   * Called when turn changes
   */
  onTurnChange(state) {
    return state;
  }
  
  /**
   * Check if win condition is met
   */
  checkWinCondition(state) {
    return false;
  }
  
  /**
   * Get initial plugin-specific data
   */
  getInitialPluginData() {
    return {};
  }
  
  // === HELPER METHODS ===
  
  /**
   * Get player by ID
   */
  getPlayer(state, playerId) {
    return state.room.seats.find(s => s.player_id === playerId);
  }
  
  /**
   * Get current turn player
   */
  getCurrentPlayer(state) {
    const currentIndex = state.game_state.turn.current_turn_index;
    const turnOrder = state.game_state.turn.turn_order;
    return state.room.seats[turnOrder[currentIndex]];
  }
  
  /**
   * Update player hand
   */
  updatePlayerHand(state, playerId, cards) {
    state.hands[playerId].cards = cards;
    state.hands[playerId].card_count = cards.length;
    
    // Recalculate hand value
    const scoreData = this.calculateScore(cards);
    state.hands[playerId].hand_value = scoreData.value;
    state.hands[playerId].hand_rank = scoreData.rank;
    
    return state;
  }
  
  /**
   * Log action to history
   */
  logAction(state, playerId, actionType, actionData) {
    state.action_history.push({
      timestamp: new Date().toISOString(),
      player_id: playerId,
      action_type: actionType,
      action_data: actionData,
      result: 'success'
    });
    return state;
  }
}

export default GamePlugin;
