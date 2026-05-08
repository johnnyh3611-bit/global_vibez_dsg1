/**
 * BlackjackPlugin.js - Blackjack Game Rules
 * 
 * Classic casino Blackjack (21) implementation.
 * Demonstrates the Universal Card Game Engine with a simple betting game.
 * 
 * Rules:
 * - Get as close to 21 as possible without going over
 * - Dealer must hit on 16 or less, stand on 17 or more
 * - Blackjack (Ace + 10-value card) pays 3:2
 * - Player can hit, stand, double down, or split pairs
 * 
 * @extends GamePlugin
 */

import { GamePlugin } from '../engine/core/PluginInterface';
import { DeckMechanics } from '../engine/mechanics/DeckMechanics';
import { BettingMechanics } from '../engine/mechanics/BettingMechanics';

export class BlackjackPlugin extends GamePlugin {
  constructor() {
    super({
      gameType: 'blackjack',
      displayName: 'Blackjack',
      version: '1.0.0',
      minPlayers: 1,
      maxPlayers: 7,
      deckType: 'standard_52',
      hasBetting: true,
      hasTricks: false,
      turnTimer: 60,
      autoDeal: false,
      minBet: 20000,
      startingChips: 100000,
      scoreType: 'chips',
      winCondition: { type: 'dealer_vs_players' }
    });
    
    this.dealerName = 'NOVA'; // AI Dealer
  }
  
  // === REQUIRED METHODS ===
  
  /**
   * Validate if action is legal
   */
  validateAction(state, playerId, action) {
    const player = this.getPlayer(state, playerId);
    if (!player) return false;
    
    const playerHand = state.hands[playerId];
    const phase = state.game_state.phase.current;
    
    switch (action.type) {
      case 'bet':
        // Can only bet before dealing
        if (phase !== 'betting') return false;
        if (action.amount < state.game_state.pot.min_bet) return false;
        if (action.amount > state.game_state.score.players[playerId].current) return false;
        return true;
      
      case 'hit':
        // Can hit if it's your turn and you haven't busted/stood
        if (phase !== 'playing') return false;
        if (player.state === 'stood' || player.state === 'busted') return false;
        return true;
      
      case 'stand':
        // Can stand if it's your turn
        if (phase !== 'playing') return false;
        if (player.state === 'stood' || player.state === 'busted') return false;
        return true;
      
      case 'double':
        // Can only double on first two cards
        if (playerHand.card_count !== 2) return false;
        if (action.amount > state.game_state.score.players[playerId].current) return false;
        return true;
      
      case 'split':
        // Can split if two cards of same rank
        if (playerHand.card_count !== 2) return false;
        const cards = playerHand.cards;
        if (cards[0].rank !== cards[1].rank) return false;
        return true;
      
      default:
        return false;
    }
  }
  
  /**
   * Execute action and update state
   */
  executeAction(state, playerId, action) {
    const newState = { ...state };
    
    switch (action.type) {
      case 'bet':
        return this.executeBet(newState, playerId, action.amount);
      
      case 'hit':
        return this.executeHit(newState, playerId);
      
      case 'stand':
        return this.executeStand(newState, playerId);
      
      case 'double':
        return this.executeDouble(newState, playerId, action.amount);
      
      case 'split':
        return this.executeSplit(newState, playerId);
      
      default:
        return state;
    }
  }
  
  /**
   * Calculate hand value (Blackjack scoring)
   */
  calculateScore(hand) {
    let value = 0;
    let aces = 0;
    
    hand.forEach(card => {
      if (card.rank === 'A') {
        aces++;
        value += 11;
      } else if (['K', 'Q', 'J'].includes(card.rank)) {
        value += 10;
      } else {
        value += parseInt(card.rank);
      }
    });
    
    // Adjust for Aces (count as 1 if busted)
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    
    // Determine hand rank
    let rank = 'hand';
    if (hand.length === 2 && value === 21) {
      rank = 'blackjack';
    } else if (value > 21) {
      rank = 'bust';
    } else if (value === 21) {
      rank = '21';
    }
    
    return {
      value,
      rank,
      description: rank === 'blackjack' ? 'Blackjack!' : `${value}`
    };
  }
  
  /**
   * Determine winner (player vs dealer)
   */
  determineWinner(state) {
    const dealerHand = state.hands['dealer'];
    const dealerScore = this.calculateScore(dealerHand.cards);
    
    const results = {};
    
    // Check each player against dealer
    Object.keys(state.hands).forEach(playerId => {
      if (playerId === 'dealer') return;
      
      const playerHand = state.hands[playerId];
      const playerScore = this.calculateScore(playerHand.cards);
      
      let result = 'loss';
      let payout = 0;
      
      // Player busted - automatic loss
      if (playerScore.value > 21) {
        result = 'loss';
      }
      // Dealer busted - player wins
      else if (dealerScore.value > 21) {
        result = 'win';
        payout = state.plugin_data.bets[playerId] * 2;
      }
      // Both have blackjack - push
      else if (playerScore.rank === 'blackjack' && dealerScore.rank === 'blackjack') {
        result = 'push';
        payout = state.plugin_data.bets[playerId];
      }
      // Player has blackjack - wins 3:2
      else if (playerScore.rank === 'blackjack') {
        result = 'blackjack';
        payout = state.plugin_data.bets[playerId] * 2.5;
      }
      // Dealer has blackjack - player loses
      else if (dealerScore.rank === 'blackjack') {
        result = 'loss';
      }
      // Compare values
      else if (playerScore.value > dealerScore.value) {
        result = 'win';
        payout = state.plugin_data.bets[playerId] * 2;
      }
      // Tie
      else if (playerScore.value === dealerScore.value) {
        result = 'push';
        payout = state.plugin_data.bets[playerId];
      }
      // Dealer wins
      else {
        result = 'loss';
      }
      
      results[playerId] = {
        result,
        playerScore: playerScore.value,
        dealerScore: dealerScore.value,
        payout
      };
    });
    
    return results;
  }
  
  /**
   * Get valid actions for player
   */
  getValidActions(state, playerId) {
    const actions = [];
    const phase = state.game_state.phase.current;
    const player = this.getPlayer(state, playerId);
    const playerHand = state.hands[playerId];
    
    if (phase === 'betting') {
      actions.push({ type: 'bet', label: 'Place Bet' });
    }
    
    if (phase === 'playing' && player.is_current_turn) {
      if (player.state !== 'stood' && player.state !== 'busted') {
        actions.push({ type: 'hit', label: 'Hit' });
        actions.push({ type: 'stand', label: 'Stand' });
        
        // Can double on first two cards
        if (playerHand.card_count === 2) {
          actions.push({ type: 'double', label: 'Double Down' });
        }
        
        // Can split pairs
        if (playerHand.card_count === 2 && 
            playerHand.cards[0].rank === playerHand.cards[1].rank) {
          actions.push({ type: 'split', label: 'Split' });
        }
      }
    }
    
    return actions;
  }
  
  // === LIFECYCLE HOOKS ===
  
  onGameStart(state) {
    // Initialize dealer hand
    state.hands['dealer'] = {
      cards: [],
      card_count: 0,
      hand_value: 0,
      hand_rank: null,
      visible_to: ['all']
    };
    
    // Set phase to betting
    state.game_state.phase.current = 'betting';
    
    return state;
  }
  
  onTurnChange(state) {
    // Auto-play dealer's turn
    if (state.game_state.phase.current === 'dealer_turn') {
      return this.playDealerHand(state);
    }
    return state;
  }
  
  getInitialPluginData() {
    return {
      bets: {},
      dealerHoleCard: null,
      roundNumber: 0
    };
  }
  
  // === BLACKJACK-SPECIFIC LOGIC ===
  
  executeBet(state, playerId, amount) {
    // Deduct bet from player
    state.game_state.score.players[playerId].current -= amount;
    
    // Store bet
    state.plugin_data.bets[playerId] = amount;
    state.game_state.pot.total += amount;
    
    // Check if all players have bet
    const allPlayersBet = state.room.seats.every(seat =>
      state.plugin_data.bets[seat.player_id]
    );
    
    if (allPlayersBet) {
      // Start dealing
      state = this.dealInitialCards(state);
    }
    
    return this.logAction(state, playerId, 'bet', { amount });
  }
  
  executeHit(state, playerId) {
    // Draw one card
    const card = state.deck.cards.shift();
    card.owner = playerId;
    card.face_state = 'up';
    
    state.hands[playerId].cards.push(card);
    state.hands[playerId].card_count++;
    
    // Recalculate score
    const score = this.calculateScore(state.hands[playerId].cards);
    state.hands[playerId].hand_value = score.value;
    state.hands[playerId].hand_rank = score.rank;
    
    // Check if busted
    if (score.value > 21) {
      const player = this.getPlayer(state, playerId);
      player.state = 'busted';
      
      // Move to next player
      state = this.moveToNextPlayer(state);
    }
    
    return this.logAction(state, playerId, 'hit', { card: card.id });
  }
  
  executeStand(state, playerId) {
    const player = this.getPlayer(state, playerId);
    player.state = 'stood';
    
    // Move to next player
    state = this.moveToNextPlayer(state);
    
    return this.logAction(state, playerId, 'stand', {});
  }
  
  executeDouble(state, playerId, amount) {
    // Double the bet
    state.game_state.score.players[playerId].current -= amount;
    state.plugin_data.bets[playerId] += amount;
    state.game_state.pot.total += amount;
    
    // Hit once and stand
    state = this.executeHit(state, playerId);
    
    const player = this.getPlayer(state, playerId);
    if (player.state !== 'busted') {
      player.state = 'stood';
      state = this.moveToNextPlayer(state);
    }
    
    return this.logAction(state, playerId, 'double', { amount });
  }
  
  executeSplit(state, playerId) {
    // TODO: Implement split logic (complex - requires creating second hand)
    // For MVP, we can skip this
    return state;
  }
  
  dealInitialCards(state) {
    // Deal 2 cards to each player and dealer
    const players = state.room.seats.map(s => s.player_id);
    
    // Round 1: First card to all (face up)
    players.forEach(playerId => {
      const card = state.deck.cards.shift();
      card.owner = playerId;
      card.face_state = 'up';
      state.hands[playerId].cards.push(card);
      state.hands[playerId].card_count++;
    });
    
    // Dealer first card (face up)
    const dealerCard1 = state.deck.cards.shift();
    dealerCard1.face_state = 'up';
    state.hands['dealer'].cards.push(dealerCard1);
    state.hands['dealer'].card_count++;
    
    // Round 2: Second card to all
    players.forEach(playerId => {
      const card = state.deck.cards.shift();
      card.owner = playerId;
      card.face_state = 'up';
      state.hands[playerId].cards.push(card);
      state.hands[playerId].card_count++;
      
      // Calculate initial score
      const score = this.calculateScore(state.hands[playerId].cards);
      state.hands[playerId].hand_value = score.value;
      state.hands[playerId].hand_rank = score.rank;
    });
    
    // Dealer second card (face down - hole card)
    const dealerHoleCard = state.deck.cards.shift();
    dealerHoleCard.face_state = 'down';
    state.hands['dealer'].cards.push(dealerHoleCard);
    state.hands['dealer'].card_count++;
    state.plugin_data.dealerHoleCard = dealerHoleCard.id;
    
    // Set phase to playing
    state.game_state.phase.current = 'playing';
    state.room.seats[0].is_current_turn = true;
    
    return state;
  }
  
  moveToNextPlayer(state) {
    // Find next player who hasn't finished
    const currentIndex = state.game_state.turn.current_turn_index;
    const turnOrder = state.game_state.turn.turn_order;
    
    // Clear current turn
    state.room.seats[turnOrder[currentIndex]].is_current_turn = false;
    
    let nextIndex = (currentIndex + 1) % turnOrder.length;
    let foundNext = false;
    
    // Find next active player
    for (let i = 0; i < turnOrder.length; i++) {
      const player = state.room.seats[turnOrder[nextIndex]];
      if (player.state !== 'stood' && player.state !== 'busted') {
        state.room.seats[turnOrder[nextIndex]].is_current_turn = true;
        state.game_state.turn.current_turn_index = nextIndex;
        foundNext = true;
        break;
      }
      nextIndex = (nextIndex + 1) % turnOrder.length;
    }
    
    // No more players - dealer's turn
    if (!foundNext) {
      state.game_state.phase.current = 'dealer_turn';
      state = this.playDealerHand(state);
    }
    
    return state;
  }
  
  playDealerHand(state) {
    // Reveal hole card
    const holeCard = state.hands['dealer'].cards.find(
      c => c.id === state.plugin_data.dealerHoleCard
    );
    if (holeCard) {
      holeCard.face_state = 'up';
    }
    
    // Dealer must hit on 16 or less
    let dealerScore = this.calculateScore(state.hands['dealer'].cards);
    
    while (dealerScore.value < 17) {
      const card = state.deck.cards.shift();
      card.face_state = 'up';
      state.hands['dealer'].cards.push(card);
      state.hands['dealer'].card_count++;
      
      dealerScore = this.calculateScore(state.hands['dealer'].cards);
    }
    
    state.hands['dealer'].hand_value = dealerScore.value;
    state.hands['dealer'].hand_rank = dealerScore.rank;
    
    // Showdown - determine winners and pay out
    const results = this.determineWinner(state);
    
    Object.keys(results).forEach(playerId => {
      const result = results[playerId];
      state.game_state.score.players[playerId].current += result.payout;
    });
    
    // Store results in plugin data
    state.plugin_data.results = results;
    state.game_state.phase.current = 'finished';
    
    return state;
  }
}

export default BlackjackPlugin;
