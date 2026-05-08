/**
 * UNO Game Logic (4-Player)
 * Implements card matching, special cards, stacking, and wild selection
 * Based on UE5 C++ architecture - Web foundation
 */
import { GameLogic } from '../GameLogic';

export class UnoLogic extends GameLogic {
  /**
   * Validate if a card can be played
   * Implements stacking rules from C++ version
   */
  validateMove(state, action) {
    const { card, playerId, wildColor } = action.payload;
    
    // Get current game state
    const topCard = state.top_card || state.discard_pile?.[state.discard_pile.length - 1];
    const currentStackValue = state.draw_stack || 0;
    
    if (!topCard) {
      return { valid: true }; // First card, any card is valid
    }

    const playedCard = this.parseCard(card);
    const topCardParsed = this.parseCard(topCard);

    if (!playedCard) {
      return { valid: false, reason: "Invalid card format" };
    }

    // STACKING RULES: If a Draw chain is active, only allow stacking
    if (currentStackValue > 0) {
      const canStack = (
        playedCard.type === 'draw2' || 
        playedCard.type === 'draw4'
      );
      
      if (!canStack) {
        return { 
          valid: false, 
          reason: `Must stack +2 or +4 (current stack: +${currentStackValue})` 
        };
      }
      
      return { valid: true };
    }

    // WILD CARDS: Always playable
    if (playedCard.color === 'wild') {
      if (playedCard.type === 'draw4') {
        // Optional: Challenge rule - must not have matching color
        // For now, always allow
        return { valid: true };
      }
      return { valid: true };
    }

    // STANDARD RULES: Match color, number, or type
    const matchesColor = playedCard.color === topCardParsed.color;
    const matchesNumber = playedCard.value === topCardParsed.value;
    const matchesType = playedCard.type === topCardParsed.type;

    // Special: If top card was wild, match against declared color
    const declaredColor = state.wild_color;
    if (declaredColor && topCardParsed.color === 'wild') {
      if (playedCard.color === declaredColor) {
        return { valid: true };
      }
    }

    if (matchesColor || matchesNumber || matchesType) {
      return { valid: true };
    }

    return { 
      valid: false, 
      reason: `Must match color (${topCardParsed.color}) or number (${topCardParsed.value})` 
    };
  }

  /**
   * Parse UNO card format
   * Examples: "R5" = Red 5, "BS" = Blue Skip, "WD4" = Wild Draw 4
   */
  parseCard(cardStr) {
    if (!cardStr || cardStr.length < 2) return null;

    const colorMap = {
      'R': 'red',
      'B': 'blue',
      'G': 'green',
      'Y': 'yellow',
      'W': 'wild'
    };

    const firstChar = cardStr[0];
    const rest = cardStr.slice(1);

    const color = colorMap[firstChar];
    if (!color) return null;

    // Determine card type and value
    let type = 'number';
    let value = null;

    if (rest === 'S') {
      type = 'skip';
    } else if (rest === 'R') {
      type = 'reverse';
    } else if (rest === 'D2') {
      type = 'draw2';
    } else if (rest === 'D4') {
      type = 'draw4';
    } else if (rest === 'W') {
      type = 'wild';
    } else {
      value = parseInt(rest);
      if (isNaN(value)) return null;
    }

    return { color, type, value, card: cardStr };
  }

  /**
   * Calculate win condition
   */
  calculateWin(state) {
    // Check each player's hand
    for (let i = 1; i <= 4; i++) {
      const playerKey = `player${i}`;
      const hand = state.hands?.[playerKey] || [];
      
      if (hand.length === 0) {
        return { 
          winner: playerKey, 
          reason: 'UNO! All cards played!',
          finalCard: state.last_played_card
        };
      }
    }
    
    return null;
  }

  /**
   * Get next player with Skip/Reverse logic
   */
  getNextPlayer(state) {
    const players = ['player1', 'player2', 'player3', 'player4'];
    const currentIndex = players.indexOf(state.current_turn);
    
    // Check if last card was Reverse
    if (state.last_card_type === 'reverse') {
      // Reverse direction
      const direction = state.direction || 1;
      const newDirection = direction * -1;
      state.direction = newDirection;
      
      const nextIndex = (currentIndex + newDirection + 4) % 4;
      return players[nextIndex];
    }
    
    // Check if last card was Skip
    if (state.last_card_type === 'skip') {
      const direction = state.direction || 1;
      const nextIndex = (currentIndex + (direction * 2) + 4) % 4;
      return players[nextIndex];
    }
    
    // Normal rotation
    const direction = state.direction || 1;
    const nextIndex = (currentIndex + direction + 4) % 4;
    return players[nextIndex];
  }

  /**
   * Process special card effects
   */
  processCardEffects(state, card) {
    const parsed = this.parseCard(card);
    if (!parsed) return state;

    const newState = { ...state };
    newState.last_card_type = parsed.type;
    newState.last_played_card = card;

    // Draw 2 - Add to stack
    if (parsed.type === 'draw2') {
      newState.draw_stack = (state.draw_stack || 0) + 2;
      newState.pending_draw_player = this.getNextPlayer(state);
    }

    // Draw 4 - Add to stack
    if (parsed.type === 'draw4') {
      newState.draw_stack = (state.draw_stack || 0) + 4;
      newState.pending_draw_player = this.getNextPlayer(state);
    }

    // Skip - Already handled in getNextPlayer

    // Reverse - Already handled in getNextPlayer

    // Wild - Set color
    if (parsed.color === 'wild' && state.wild_color) {
      newState.top_card_color = state.wild_color;
    }

    return newState;
  }

  /**
   * Check if player must draw from stack
   */
  mustDrawFromStack(state, playerId) {
    return state.pending_draw_player === playerId && state.draw_stack > 0;
  }

  /**
   * Execute draw penalty
   */
  executeDrawPenalty(state, playerId) {
    const drawCount = state.draw_stack || 0;
    const newState = { ...state };
    
    // Clear stack
    newState.draw_stack = 0;
    newState.pending_draw_player = null;
    
    // Player draws cards (handled by backend)
    newState.last_action = `${playerId} draws ${drawCount} cards`;
    
    return newState;
  }
}
