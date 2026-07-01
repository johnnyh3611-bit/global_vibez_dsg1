/**
 * GameEngine.js - The Universal Card Game Engine Core
 * 
 * The brain of the Universal Card Game system.
 * This code NEVER changes when adding new games.
 * 
 * Responsibilities:
 * - Manage universal game state
 * - Coordinate with game plugins
 * - Execute atomic mechanics
 * - Sync state across network
 * - Validate actions through plugins
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';
import { DeckMechanics } from '../mechanics/DeckMechanics';
import { TurnMechanics } from '../mechanics/TurnMechanics';

/**
 * Universal Game State Structure
 */
export class GameState {
  constructor(gameType, roomCode, plugin) {
    this.game_id = uuidv4();
    this.game_type = gameType;
    this.plugin_version = plugin.version || '1.0.0';
    this.created_at = new Date().toISOString();
    this.status = 'waiting'; // waiting | active | paused | completed
    
    this.room = {
      room_code: roomCode,
      max_players: plugin.maxPlayers || 6,
      min_players: plugin.minPlayers || 2,
      current_player_count: 0,
      layout_type: this.getLayoutType(plugin.maxPlayers),
      seats: [],
      dealer_position: 0,
      spectators: []
    };
    
    this.deck = {
      type: plugin.deckType || 'standard_52',
      cards: [],
      shuffle_algorithm: 'fisher_yates',
      cards_remaining: 0,
      discard_pile: []
    };
    
    this.game_state = {
      turn: {
        current_turn_index: 0,
        turn_order: [],
        turn_direction: 'clockwise',
        turn_timer: plugin.turnTimer || 30,
        actions_taken_this_turn: []
      },
      phase: {
        current: 'waiting',
        phase_history: [],
        valid_actions: []
      },
      pot: plugin.hasBetting ? {
        total: 0,
        side_pots: [],
        current_bet: 0,
        min_bet: plugin.minBet || 10,
        players_in_pot: []
      } : null,
      trick: plugin.hasTricks ? {
        current_trick: 0,
        total_tricks: plugin.totalTricks || 13,
        cards_played_this_trick: [],
        trick_winner: null,
        tricks_won: {}
      } : null,
      score: {
        type: plugin.scoreType || 'points',
        players: {},
        win_condition: plugin.winCondition || { type: 'highest_score', target: 1000 }
      }
    };
    
    this.hands = {};
    this.table_cards = {
      community: [],
      visible_to: 'all',
      layout: 'linear'
    };
    
    this.plugin_data = plugin.getInitialPluginData ? plugin.getInitialPluginData() : {};
    this.action_history = [];
    
    this.settings = {
      allow_spectators: true,
      allow_chat: true,
      auto_deal: plugin.autoDeal || false,
      animation_speed: 'normal',
      language: 'en'
    };
  }
  
  getLayoutType(playerCount) {
    const layouts = {
      1: 'solitaire',
      2: 'face_to_face',
      3: 'triangle',
      4: 'square',
      5: 'pentagon',
      6: 'hexagonal',
      7: 'heptagon',
      8: 'octagon',
      9: 'nonagon',
      10: 'decagon'
    };
    return layouts[playerCount] || 'circular';
  }
}

/**
 * GameEngine - The Core
 */
export class GameEngine {
  constructor(plugin, roomCode = null) {
    this.plugin = plugin;
    this.state = new GameState(plugin.gameType, roomCode || this.generateRoomCode(), plugin);
    this.eventHandlers = {};
  }
  
  // === ROOM MANAGEMENT ===
  
  generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  
  addPlayer(playerId, playerName, socketId) {
    const seatIndex = this.state.room.seats.length;
    
    const seat = {
      seat_index: seatIndex,
      player_id: playerId,
      player_name: playerName,
      socket_id: socketId,
      position: this.calculateSeatPosition(seatIndex),
      is_active: true,
      is_dealer: seatIndex === 0, // First player is initial dealer
      is_current_turn: false,
      state: 'waiting'
    };
    
    this.state.room.seats.push(seat);
    this.state.room.current_player_count++;
    
    // Initialize player hand
    this.state.hands[playerId] = {
      cards: [],
      card_count: 0,
      hand_value: 0,
      hand_rank: null,
      visible_to: [playerId]
    };
    
    // Initialize player score
    const startingAmount = this.plugin.startingChips || this.plugin.startingScore || 0;
    this.state.game_state.score.players[playerId] = {
      current: startingAmount,
      starting: startingAmount,
      delta: 0
    };
    
    // Let plugin handle player join
    if (this.plugin.onPlayerJoin) {
      this.state = this.plugin.onPlayerJoin(this.state, seat);
    }
    
    this.logAction('player_join', playerId, { seat_index: seatIndex });
    
    return seat;
  }
  
  removePlayer(playerId) {
    const seatIndex = this.state.room.seats.findIndex(s => s.player_id === playerId);
    if (seatIndex === -1) return false;
    
    this.state.room.seats.splice(seatIndex, 1);
    this.state.room.current_player_count--;
    
    // Remove from hands and scores
    delete this.state.hands[playerId];
    delete this.state.game_state.score.players[playerId];
    
    // Let plugin handle player leave
    if (this.plugin.onPlayerLeave) {
      this.state = this.plugin.onPlayerLeave(this.state, playerId);
    }
    
    this.logAction('player_leave', playerId, {});
    
    return true;
  }
  
  calculateSeatPosition(seatIndex) {
    const playerCount = this.state.room.max_players;
    const angle = (360 / playerCount) * seatIndex;
    const radius = playerCount <= 4 ? 200 : 300;
    
    return {
      angle,
      radius,
      x: Math.cos((angle * Math.PI) / 180) * radius,
      y: Math.sin((angle * Math.PI) / 180) * radius,
      rotation: angle + 90
    };
  }
  
  // === GAME LIFECYCLE ===
  
  startGame() {
    if (this.state.room.current_player_count < this.state.room.min_players) {
      throw new Error(`Need at least ${this.state.room.min_players} players to start`);
    }
    
    this.state.status = 'active';
    this.state.game_state.phase.current = 'dealing';
    
    // Initialize deck
    this.state.deck.cards = DeckMechanics.createDeck(this.state.deck.type);
    this.state.deck.cards = DeckMechanics.shuffle(this.state.deck.cards);
    this.state.deck.cards_remaining = this.state.deck.cards.length;
    
    // Set turn order
    this.state.game_state.turn.turn_order = this.state.room.seats.map(s => s.seat_index);
    this.state.room.seats[0].is_current_turn = true;
    
    // Let plugin handle game start
    if (this.plugin.onGameStart) {
      this.state = this.plugin.onGameStart(this.state);
    }
    
    this.logAction('game_start', 'system', { player_count: this.state.room.current_player_count });
    
    return this.state;
  }
  
  endGame() {
    this.state.status = 'completed';
    this.state.game_state.phase.current = 'finished';
    
    // Let plugin determine winner
    const winner = this.plugin.determineWinner(this.state);
    
    // Let plugin handle game end
    if (this.plugin.onGameEnd) {
      this.state = this.plugin.onGameEnd(this.state, winner);
    }
    
    this.logAction('game_end', 'system', { winner });
    
    return { state: this.state, winner };
  }
  
  pauseGame() {
    this.state.status = 'paused';
    this.logAction('game_pause', 'system', {});
  }
  
  resumeGame() {
    this.state.status = 'active';
    this.logAction('game_resume', 'system', {});
  }
  
  // === ACTION EXECUTION ===
  
  executeAction(playerId, action) {
    // Validate it's player's turn
    const playerSeat = this.state.room.seats.find(s => s.player_id === playerId);
    if (!playerSeat) {
      throw new Error('Player not in game');
    }
    
    if (!playerSeat.is_current_turn && action.type !== 'chat') {
      throw new Error('Not your turn');
    }
    
    // Let plugin validate action
    const isValid = this.plugin.validateAction(this.state, playerId, action);
    if (!isValid) {
      this.logAction('invalid_action', playerId, action);
      throw new Error(`Invalid action: ${action.type}`);
    }
    
    // Execute action through plugin
    this.state = this.plugin.executeAction(this.state, playerId, action);
    
    // Log action
    this.logAction(action.type, playerId, action);
    
    // Check for game end condition
    if (this.plugin.checkWinCondition && this.plugin.checkWinCondition(this.state)) {
      return this.endGame();
    }
    
    return this.state;
  }
  
  // === TURN MANAGEMENT ===
  
  nextTurn() {
    const currentIndex = this.state.game_state.turn.current_turn_index;
    const turnOrder = this.state.game_state.turn.turn_order;
    const direction = this.state.game_state.turn.turn_direction;
    
    // Clear current turn
    this.state.room.seats[turnOrder[currentIndex]].is_current_turn = false;
    
    // Calculate next turn
    const nextIndex = TurnMechanics.nextTurn(
      currentIndex,
      turnOrder.length,
      direction
    );
    
    this.state.game_state.turn.current_turn_index = nextIndex;
    this.state.room.seats[turnOrder[nextIndex]].is_current_turn = true;
    this.state.game_state.turn.actions_taken_this_turn = [];
    
    // Let plugin handle turn change
    if (this.plugin.onTurnChange) {
      this.state = this.plugin.onTurnChange(this.state);
    }
    
    return this.state;
  }
  
  reverseTurnDirection() {
    this.state.game_state.turn.turn_direction = 
      this.state.game_state.turn.turn_direction === 'clockwise' 
        ? 'counter_clockwise' 
        : 'clockwise';
  }
  
  skipTurn() {
    this.logAction('skip_turn', 'system', { 
      skipped_player: this.getCurrentPlayer().player_id 
    });
    this.nextTurn();
  }
  
  // === HELPER METHODS ===
  
  getCurrentPlayer() {
    const currentIndex = this.state.game_state.turn.current_turn_index;
    const turnOrder = this.state.game_state.turn.turn_order;
    return this.state.room.seats[turnOrder[currentIndex]];
  }
  
  getPlayer(playerId) {
    return this.state.room.seats.find(s => s.player_id === playerId);
  }
  
  getValidActions(playerId) {
    return this.plugin.getValidActions(this.state, playerId);
  }
  
  logAction(actionType, playerId, actionData) {
    this.state.action_history.push({
      timestamp: new Date().toISOString(),
      player_id: playerId,
      action_type: actionType,
      action_data: actionData,
      result: 'success'
    });
  }
  
  // === EVENT SYSTEM ===
  
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }
  
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }
  
  // === STATE EXPORT ===
  
  getState() {
    return this.state;
  }
  
  getStateForPlayer(playerId) {
    // Return state with only visible information for this player
    const state = JSON.parse(JSON.stringify(this.state));
    
    // Hide other players' cards
    Object.keys(state.hands).forEach(pid => {
      if (pid !== playerId && !state.hands[pid].visible_to.includes(playerId)) {
        state.hands[pid].cards = state.hands[pid].cards.map(() => ({ 
          id: 'hidden', 
          face_state: 'down' 
        }));
      }
    });
    
    return state;
  }
}

export default GameEngine;
