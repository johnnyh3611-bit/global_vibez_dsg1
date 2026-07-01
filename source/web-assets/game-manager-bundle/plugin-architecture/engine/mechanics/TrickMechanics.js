/**
 * TrickMechanics.js - Universal Trick-Taking System
 * 
 * Atomic mechanics for trick-taking card games.
 * Used by Spades, Bid Whist, Hearts, Bridge, etc.
 * 
 * Operations:
 * - Start new trick
 * - Play card to trick
 * - Determine trick winner
 * - Score tricks
 * - Handle trump suits
 * - Validate card play (following suit)
 */

export const TrickMechanics = {
  /**
   * Start a new trick
   */
  startTrick(trickNumber, leadPlayer) {
    return {
      trick_number: trickNumber,
      lead_player: leadPlayer,
      cards_played: [],
      lead_suit: null,
      winner: null
    };
  },
  
  /**
   * Play a card to the current trick
   */
  playCardToTrick(trick, playerId, card) {
    const updatedTrick = { ...trick };
    
    // First card sets the lead suit
    if (updatedTrick.cards_played.length === 0) {
      updatedTrick.lead_suit = card.suit;
    }
    
    updatedTrick.cards_played.push({
      player_id: playerId,
      card: card
    });
    
    return updatedTrick;
  },
  
  /**
   * Check if player must follow suit
   */
  mustFollowSuit(playerHand, leadSuit) {
    return playerHand.some(card => card.suit === leadSuit);
  },
  
  /**
   * Validate card play (following suit rules)
   */
  isValidPlay(card, leadSuit, playerHand) {
    // If leading, any card is valid
    if (!leadSuit) return true;
    
    // If playing lead suit, valid
    if (card.suit === leadSuit) return true;
    
    // If player has no cards of lead suit, any card is valid
    const hasLeadSuit = playerHand.some(c => c.suit === leadSuit);
    return !hasLeadSuit;
  },
  
  /**
   * Determine trick winner
   */
  determineTrickWinner(trick, trumpSuit = null, rankOrder = null) {
    if (trick.cards_played.length === 0) return null;
    
    const leadSuit = trick.lead_suit;
    let winningPlay = trick.cards_played[0];
    
    trick.cards_played.forEach(play => {
      const card = play.card;
      const winningCard = winningPlay.card;
      
      // Trump beats non-trump
      if (trumpSuit) {
        if (card.suit === trumpSuit && winningCard.suit !== trumpSuit) {
          winningPlay = play;
          return;
        }
        if (card.suit !== trumpSuit && winningCard.suit === trumpSuit) {
          return;
        }
      }
      
      // Within same suit, higher rank wins
      if (card.suit === winningCard.suit) {
        if (this.compareRanks(card.rank, winningCard.rank, rankOrder) > 0) {
          winningPlay = play;
        }
      }
      
      // Lead suit beats off-suit (if no trump involved)
      if (!trumpSuit && card.suit === leadSuit && winningCard.suit !== leadSuit) {
        winningPlay = play;
      }
    });
    
    return winningPlay.player_id;
  },
  
  /**
   * Compare card ranks
   * Returns: 1 if rank1 > rank2, -1 if rank1 < rank2, 0 if equal
   */
  compareRanks(rank1, rank2, customOrder = null) {
    const defaultOrder = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const order = customOrder || defaultOrder;
    
    const index1 = order.indexOf(rank1);
    const index2 = order.indexOf(rank2);
    
    if (index1 > index2) return 1;
    if (index1 < index2) return -1;
    return 0;
  },
  
  /**
   * Award trick to winner
   */
  awardTrick(tricksWon, winnerId) {
    return {
      ...tricksWon,
      [winnerId]: (tricksWon[winnerId] || 0) + 1
    };
  },
  
  /**
   * Calculate trick-based score
   */
  calculateTrickScore(tricksWon, bid, pointsPerTrick = 10, bidBonus = 50) {
    let score = 0;
    
    if (tricksWon >= bid) {
      // Made bid
      score = (bid * pointsPerTrick) + bidBonus;
      // Overtricks (bags)
      const overtricks = tricksWon - bid;
      score += overtricks * (pointsPerTrick / 2);
    } else {
      // Failed to make bid
      score = -(bid * pointsPerTrick);
    }
    
    return score;
  },
  
  /**
   * Check if all players have played to trick
   */
  isTrickComplete(trick, playerCount) {
    return trick.cards_played.length === playerCount;
  },
  
  /**
   * Get next lead player (trick winner leads next)
   */
  getNextLeadPlayer(trickWinner) {
    return trickWinner;
  },
  
  /**
   * Handle "Bags" penalty (Spades rule: 10 bags = -100 points)
   */
  calculateBagsPenalty(totalBags, penaltyThreshold = 10, penaltyPoints = -100) {
    const penalties = Math.floor(totalBags / penaltyThreshold);
    return penalties * penaltyPoints;
  },
  
  /**
   * Check for "nil" bid (bidding zero tricks)
   */
  checkNilBid(tricksWon, nilBonus = 100, nilPenalty = -100) {
    if (tricksWon === 0) {
      return nilBonus; // Successfully made nil
    }
    return nilPenalty; // Failed nil
  }
};

export default TrickMechanics;
