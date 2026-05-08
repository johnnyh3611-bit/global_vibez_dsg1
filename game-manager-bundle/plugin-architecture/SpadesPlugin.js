/**
 * SpadesPlugin.js - Spades Card Game
 * 
 * Classic 4-player partnership trick-taking game.
 * 
 * Rules:
 * - 4 players in 2 partnerships (North/South vs East/West)
 * - Each player bids number of tricks they'll take
 * - Spades are always trump
 * - First to 500 points wins
 * 
 * @extends GamePlugin
 */

import { GamePlugin } from '../engine/core/PluginInterface';

export class SpadesPlugin extends GamePlugin {
  constructor() {
    super({
      gameType: 'spades',
      displayName: 'Spades',
      version: '1.0.0',
      minPlayers: 4,
      maxPlayers: 4,
      deckType: 'standard_52',
      hasBetting: false,
      hasTricks: true,
      totalTricks: 13,
      hasTrump: true,
      hasBidding: true,
      turnTimer: 60,
      autoDeal: false,
      scoreType: 'points',
      startingScore: 0,
      winCondition: { type: 'first_to_target', target: 500 }
    });
    
    this.trumpSuit = 'spades';
    this.partnerships = {
      team1: ['north', 'south'],
      team2: ['east', 'west']
    };
  }
  
  validateAction(state, playerId, action) {
    const player = this.getPlayer(state, playerId);
    if (!player) return false;
    
    const phase = state.game_state.phase.current;
    
    switch (action.type) {
      case 'bid':
        if (phase !== 'bidding') return false;
        if (action.tricks < 0 || action.tricks > 13) return false;
        return true;
      
      case 'play_card':
        if (phase !== 'playing') return false;
        if (!action.card) return false;
        
        const playerHand = state.hands[playerId];
        const hasCard = playerHand.cards.some(c => 
          c.suit === action.card.suit && c.rank === action.card.rank
        );
        if (!hasCard) return false;
        
        // Must follow suit if possible
        const leadSuit = state.game_state.current_trick?.lead_suit;
        if (leadSuit) {
          const hasSuit = playerHand.cards.some(c => c.suit === leadSuit);
          if (hasSuit && action.card.suit !== leadSuit) return false;
        }
        
        return true;
      
      default:
        return false;
    }
  }
  
  executeAction(state, playerId, action) {
    const newState = { ...state };
    
    switch (action.type) {
      case 'bid':
        return this.executeBid(newState, playerId, action.tricks);
      
      case 'play_card':
        return this.executePlayCard(newState, playerId, action.card);
      
      default:
        return newState;
    }
  }
  
  executeBid(state, playerId, tricks) {
    state.game_state.bids = state.game_state.bids || {};
    state.game_state.bids[playerId] = tricks;
    
    // Check if all players have bid
    const allBids = Object.keys(state.game_state.bids).length;
    if (allBids === 4) {
      state.game_state.phase.current = 'playing';
    }
    
    return state;
  }
  
  executePlayCard(state, playerId, card) {
    const playerHand = state.hands[playerId];
    
    // Remove card from hand
    playerHand.cards = playerHand.cards.filter(c => 
      !(c.suit === card.suit && c.rank === card.rank)
    );
    playerHand.card_count--;
    
    // Add to current trick
    if (!state.game_state.current_trick) {
      state.game_state.current_trick = {
        cards: [],
        lead_suit: card.suit
      };
    }
    
    state.game_state.current_trick.cards.push({
      player_id: playerId,
      card: card
    });
    
    // Check if trick is complete
    if (state.game_state.current_trick.cards.length === 4) {
      this.resolveTrick(state);
    }
    
    return state;
  }
  
  resolveTrick(state) {
    const trick = state.game_state.current_trick;
    const winner = this.determineTrickWinner(trick);
    
    state.game_state.tricks_won = state.game_state.tricks_won || {};
    state.game_state.tricks_won[winner] = (state.game_state.tricks_won[winner] || 0) + 1;
    
    // Clear trick
    state.game_state.current_trick = null;
    
    // Check if round is over
    const totalTricks = Object.values(state.game_state.tricks_won).reduce((a, b) => a + b, 0);
    if (totalTricks === 13) {
      this.scoreRound(state);
      state.game_state.phase.current = 'finished';
    }
  }
  
  determineTrickWinner(trick) {
    let winner = trick.cards[0].player_id;
    let winningCard = trick.cards[0].card;
    
    for (let i = 1; i < trick.cards.length; i++) {
      const current = trick.cards[i];
      
      // Spade always wins
      if (current.card.suit === 'spades' && winningCard.suit !== 'spades') {
        winner = current.player_id;
        winningCard = current.card;
      }
      // Higher spade
      else if (current.card.suit === 'spades' && winningCard.suit === 'spades') {
        if (this.getCardValue(current.card) > this.getCardValue(winningCard)) {
          winner = current.player_id;
          winningCard = current.card;
        }
      }
      // Higher card of lead suit
      else if (current.card.suit === trick.lead_suit && winningCard.suit === trick.lead_suit) {
        if (this.getCardValue(current.card) > this.getCardValue(winningCard)) {
          winner = current.player_id;
          winningCard = current.card;
        }
      }
    }
    
    return winner;
  }
  
  getCardValue(card) {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return values[card.rank] || 0;
  }
  
  scoreRound(state) {
    // Calculate scores based on bids vs actual tricks
    const bids = state.game_state.bids;
    const tricks = state.game_state.tricks_won;
    
    Object.keys(bids).forEach(playerId => {
      const bid = bids[playerId];
      const won = tricks[playerId] || 0;
      
      if (won >= bid) {
        // Made bid: 10 points per trick bid + 1 per overtrick
        const score = (bid * 10) + (won - bid);
        state.game_state.score.players[playerId].current += score;
      } else {
        // Failed bid: -10 points per trick bid
        state.game_state.score.players[playerId].current -= (bid * 10);
      }
    });
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
    
    if (phase === 'bidding') {
      return [{ type: 'bid', min: 0, max: 13 }];
    }
    
    if (phase === 'playing') {
      const hand = state.hands[playerId];
      return hand.cards.map(card => ({
        type: 'play_card',
        card: card
      }));
    }
    
    return [];
  }
  
  onGameStart(state) {
    state.game_state.phase.current = 'bidding';
    state.game_state.bids = {};
    state.game_state.tricks_won = {};
    return state;
  }
}