/**
 * PokerPlugin.js - Texas Hold'em Poker
 * 
 * Classic Texas Hold'em implementation for UniversalGameRoom.
 * 
 * Rules:
 * - Each player gets 2 hole cards
 * - 5 community cards (flop, turn, river)
 * - Betting rounds: pre-flop, flop, turn, river
 * - Best 5-card hand wins
 * 
 * @extends GamePlugin
 */

import { GamePlugin } from '../engine/core/PluginInterface';

export class PokerPlugin extends GamePlugin {
  constructor() {
    super({
      gameType: 'poker',
      displayName: 'Texas Hold\'em',
      version: '1.0.0',
      minPlayers: 2,
      maxPlayers: 10,
      deckType: 'standard_52',
      hasBetting: true,
      hasTricks: false,
      turnTimer: 60,
      autoDeal: false,
      minBet: 20000,
      startingChips: 100000,
      smallBlind: 10000,
      bigBlind: 20000,
      scoreType: 'chips',
      winCondition: { type: 'highest_chips' }
    });
    
    this.bettingRounds = ['pre-flop', 'flop', 'turn', 'river'];
    this.communityCards = [];
  }
  
  validateAction(state, playerId, action) {
    const player = this.getPlayer(state, playerId);
    if (!player) return false;
    
    const phase = state.game_state.phase.current;
    const playerChips = state.game_state.score.players[playerId]?.current || 0;
    
    switch (action.type) {
      case 'bet':
      case 'raise':
        if (!['pre-flop', 'flop', 'turn', 'river'].includes(phase)) return false;
        if (action.amount > playerChips) return false;
        if (action.amount < state.game_state.pot.min_bet) return false;
        return true;
      
      case 'call':
        if (!['pre-flop', 'flop', 'turn', 'river'].includes(phase)) return false;
        return true;
      
      case 'fold':
        if (!['pre-flop', 'flop', 'turn', 'river'].includes(phase)) return false;
        return true;
      
      case 'check':
        if (!['pre-flop', 'flop', 'turn', 'river'].includes(phase)) return false;
        // Can only check if no bet to call
        return state.game_state.pot.current_bet === 0;
      
      case 'all-in':
        return playerChips > 0;
      
      default:
        return false;
    }
  }
  
  executeAction(state, playerId, action) {
    const newState = { ...state };
    
    switch (action.type) {
      case 'bet':
      case 'raise':
        return this.executeBet(newState, playerId, action.amount);
      
      case 'call':
        return this.executeCall(newState, playerId);
      
      case 'fold':
        return this.executeFold(newState, playerId);
      
      case 'check':
        return this.executeCheck(newState, playerId);
      
      case 'all-in':
        return this.executeAllIn(newState, playerId);
      
      default:
        return newState;
    }
  }
  
  executeBet(state, playerId, amount) {
    const playerBalance = state.game_state.score.players[playerId].current;
    
    state.game_state.score.players[playerId].current -= amount;
    state.game_state.pot.total += amount;
    state.game_state.pot.current_bet = amount;
    
    state.game_state.phase.current = this.getNextBettingPhase(state);
    
    return state;
  }
  
  executeCall(state, playerId) {
    const callAmount = state.game_state.pot.current_bet;
    return this.executeBet(state, playerId, callAmount);
  }
  
  executeFold(state, playerId) {
    const player = this.getPlayer(state, playerId);
    player.state = 'folded';
    return state;
  }
  
  executeCheck(state, playerId) {
    // No action needed, just advance to next player
    return state;
  }
  
  executeAllIn(state, playerId) {
    const playerBalance = state.game_state.score.players[playerId].current;
    return this.executeBet(state, playerId, playerBalance);
  }
  
  getNextBettingPhase(state) {
    const current = state.game_state.phase.current;
    const index = this.bettingRounds.indexOf(current);
    if (index < this.bettingRounds.length - 1) {
      return this.bettingRounds[index + 1];
    }
    return 'showdown';
  }
  
  calculateScore(state, playerId) {
    const hand = state.hands[playerId];
    if (!hand || !hand.cards) return { value: 0, description: 'No hand' };
    
    // Simplified: return chip count
    return {
      value: state.game_state.score.players[playerId].current,
      description: `${state.game_state.score.players[playerId].current} chips`
    };
  }
  
  determineWinner(state) {
    const activePlayers = state.room.seats
      .filter(seat => seat?.player_id)
      .filter(seat => {
        const player = this.getPlayer(state, seat.player_id);
        return player.state !== 'folded';
      });
    
    if (activePlayers.length === 1) {
      return {
        winner_id: activePlayers[0].player_id,
        winning_hand: 'Last player standing',
        pot: state.game_state.pot.total
      };
    }
    
    // Simplified: highest chip count wins
    let maxChips = 0;
    let winnerId = null;
    
    activePlayers.forEach(seat => {
      const chips = state.game_state.score.players[seat.player_id].current;
      if (chips > maxChips) {
        maxChips = chips;
        winnerId = seat.player_id;
      }
    });
    
    return {
      winner_id: winnerId,
      winning_hand: 'Highest chips',
      pot: state.game_state.pot.total
    };
  }
  
  getValidActions(state, playerId) {
    const phase = state.game_state.phase.current;
    
    if (!['pre-flop', 'flop', 'turn', 'river'].includes(phase)) {
      return [];
    }
    
    const actions = [];
    const currentBet = state.game_state.pot.current_bet || 0;
    
    if (currentBet === 0) {
      actions.push({ type: 'check' });
      actions.push({ type: 'bet', min: this.minBet });
    } else {
      actions.push({ type: 'call', amount: currentBet });
      actions.push({ type: 'raise', min: currentBet * 2 });
    }
    
    actions.push({ type: 'fold' });
    actions.push({ type: 'all-in' });
    
    return actions;
  }
  
  onGameStart(state) {
    // Post blinds
    const seats = state.room.seats.filter(s => s?.player_id);
    
    if (seats.length >= 2) {
      // Small blind
      const smallBlindPlayer = seats[0].player_id;
      state.game_state.score.players[smallBlindPlayer].current -= this.smallBlind;
      state.game_state.pot.total += this.smallBlind;
      
      // Big blind
      const bigBlindPlayer = seats[1].player_id;
      state.game_state.score.players[bigBlindPlayer].current -= this.bigBlind;
      state.game_state.pot.total += this.bigBlind;
      state.game_state.pot.current_bet = this.bigBlind;
    }
    
    state.game_state.phase.current = 'pre-flop';
    return state;
  }
}