/**
 * RummyPlugin.js - Gin Rummy Card Game
 * 
 * Classic Gin Rummy implementation.
 * 
 * Rules:
 * - 2-6 players
 * - Form sets (3-4 of same rank) and runs (3+ consecutive same suit)
 * - Draw from stock or discard pile
 * - Knock when deadwood <= 10 points
 * - Gin (no deadwood) = bonus points
 * 
 * @extends GamePlugin
 */

import { GamePlugin } from '../engine/core/PluginInterface';

export class RummyPlugin extends GamePlugin {
  constructor() {
    super({
      gameType: 'rummy',
      displayName: 'Gin Rummy',
      version: '1.0.0',
      minPlayers: 2,
      maxPlayers: 6,
      deckType: 'standard_52',
      hasBetting: false,
      hasTricks: false,
      turnTimer: 60,
      autoDeal: false,
      scoreType: 'points',
      startingScore: 0,
      winCondition: { type: 'first_to_target', target: 100 }
    });
    
    this.handSize = 10;
  }
  
  validateAction(state, playerId, action) {
    const player = this.getPlayer(state, playerId);
    if (!player) return false;
    
    const phase = state.game_state.phase.current;
    
    switch (action.type) {
      case 'draw_stock':
        if (phase !== 'drawing') return false;
        return state.game_state.stock?.length > 0;
      
      case 'draw_discard':
        if (phase !== 'drawing') return false;
        return state.game_state.discard_pile?.length > 0;
      
      case 'discard':
        if (phase !== 'discarding') return false;
        if (!action.card) return false;
        
        const playerHand = state.hands[playerId];
        return playerHand.cards.some(c => 
          c.suit === action.card.suit && c.rank === action.card.rank
        );
      
      case 'knock':
        if (phase !== 'discarding') return false;
        const deadwood = this.calculateDeadwood(state, playerId);
        return deadwood <= 10;
      
      case 'gin':
        if (phase !== 'discarding') return false;
        const ginDeadwood = this.calculateDeadwood(state, playerId);
        return ginDeadwood === 0;
      
      default:
        return false;
    }
  }
  
  executeAction(state, playerId, action) {
    const newState = { ...state };
    
    switch (action.type) {
      case 'draw_stock':
        return this.executeDrawStock(newState, playerId);
      
      case 'draw_discard':
        return this.executeDrawDiscard(newState, playerId);
      
      case 'discard':
        return this.executeDiscard(newState, playerId, action.card);
      
      case 'knock':
        return this.executeKnock(newState, playerId);
      
      case 'gin':
        return this.executeGin(newState, playerId);
      
      default:
        return newState;
    }
  }
  
  executeDrawStock(state, playerId) {
    const card = state.game_state.stock.pop();
    const playerHand = state.hands[playerId];
    
    playerHand.cards.push(card);
    playerHand.card_count++;
    
    state.game_state.phase.current = 'discarding';
    return state;
  }
  
  executeDrawDiscard(state, playerId) {
    const card = state.game_state.discard_pile.pop();
    const playerHand = state.hands[playerId];
    
    playerHand.cards.push(card);
    playerHand.card_count++;
    
    state.game_state.phase.current = 'discarding';
    return state;
  }
  
  executeDiscard(state, playerId, card) {
    const playerHand = state.hands[playerId];
    
    // Remove card from hand
    playerHand.cards = playerHand.cards.filter(c => 
      !(c.suit === card.suit && c.rank === card.rank)
    );
    playerHand.card_count--;
    
    // Add to discard pile
    state.game_state.discard_pile = state.game_state.discard_pile || [];
    state.game_state.discard_pile.push(card);
    
    state.game_state.phase.current = 'drawing';
    return state;
  }
  
  executeKnock(state, playerId) {
    state.game_state.phase.current = 'scoring';
    state.game_state.knocker = playerId;
    
    this.scoreRound(state, playerId, false);
    
    return state;
  }
  
  executeGin(state, playerId) {
    state.game_state.phase.current = 'scoring';
    state.game_state.knocker = playerId;
    
    this.scoreRound(state, playerId, true);
    
    return state;
  }
  
  calculateDeadwood(state, playerId) {
    const hand = state.hands[playerId];
    if (!hand || !hand.cards) return 0;
    
    // Simplified: sum all card values (proper implementation would subtract melds)
    return hand.cards.reduce((sum, card) => {
      const value = this.getCardValue(card);
      return sum + value;
    }, 0);
  }
  
  getCardValue(card) {
    const values = {
      'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
      'J': 10, 'Q': 10, 'K': 10
    };
    return values[card.rank] || 0;
  }
  
  scoreRound(state, knockerId, isGin) {
    const knockerDeadwood = this.calculateDeadwood(state, knockerId);
    
    if (isGin) {
      // Gin bonus: 25 points + opponent's deadwood
      state.game_state.score.players[knockerId].current += 25;
      
      // Add opponents' deadwood
      Object.keys(state.hands).forEach(playerId => {
        if (playerId !== knockerId) {
          const deadwood = this.calculateDeadwood(state, playerId);
          state.game_state.score.players[knockerId].current += deadwood;
        }
      });
    } else {
      // Regular knock: difference in deadwood
      Object.keys(state.hands).forEach(playerId => {
        if (playerId !== knockerId) {
          const opponentDeadwood = this.calculateDeadwood(state, playerId);
          const diff = opponentDeadwood - knockerDeadwood;
          
          if (diff > 0) {
            state.game_state.score.players[knockerId].current += diff;
          } else {
            // Undercut: opponent gets difference + 10 bonus
            state.game_state.score.players[playerId].current += Math.abs(diff) + 10;
          }
        }
      });
    }
  }
  
  calculateScore(state, playerId) {
    return {
      value: state.game_state.score.players[playerId]?.current || 0,
      description: `${state.game_state.score.players[playerId]?.current || 0} points`
    };
  }
  
  determineWinner(state) {
    let maxScore = -Infinity;
    let winnerId = null;
    
    Object.keys(state.game_state.score.players).forEach(playerId => {
      const score = state.game_state.score.players[playerId].current;
      if (score > maxScore) {
        maxScore = score;
        winnerId = playerId;
      }
    });
    
    return {
      winner_id: winnerId,
      winning_score: maxScore,
      pot: 0
    };
  }
  
  getValidActions(state, playerId) {
    const phase = state.game_state.phase.current;
    
    if (phase === 'drawing') {
      const actions = [];
      
      if (state.game_state.stock?.length > 0) {
        actions.push({ type: 'draw_stock' });
      }
      
      if (state.game_state.discard_pile?.length > 0) {
        actions.push({ type: 'draw_discard' });
      }
      
      return actions;
    }
    
    if (phase === 'discarding') {
      const hand = state.hands[playerId];
      const actions = hand.cards.map(card => ({
        type: 'discard',
        card: card
      }));
      
      const deadwood = this.calculateDeadwood(state, playerId);
      
      if (deadwood <= 10) {
        actions.push({ type: 'knock' });
      }
      
      if (deadwood === 0) {
        actions.push({ type: 'gin' });
      }
      
      return actions;
    }
    
    return [];
  }
  
  onGameStart(state) {
    state.game_state.phase.current = 'drawing';
    state.game_state.stock = state.deck.cards || [];
    state.game_state.discard_pile = [];
    return state;
  }
}