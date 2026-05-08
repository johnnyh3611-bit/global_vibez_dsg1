/**
 * Card Game Utilities
 * Helper functions for card-based games
 */

/**
 * Parse card string (e.g., "AH" = Ace of Hearts)
 */
export const parseCard = (cardStr) => {
  if (!cardStr || cardStr.length < 2) return null;
  
  const rank = cardStr.slice(0, -1);
  const suit = cardStr.slice(-1);
  
  return { rank, suit, card: cardStr };
};

/**
 * Get suit name from letter
 */
export const getSuitName = (suit) => {
  const suits = {
    'H': 'Hearts',
    'D': 'Diamonds',
    'C': 'Clubs',
    'S': 'Spades'
  };
  return suits[suit] || suit;
};

/**
 * Check if player can follow suit
 */
export const canFollowSuit = (hand, ledSuit) => {
  return hand.some(cardStr => {
    const card = parseCard(cardStr);
    return card && card.suit === ledSuit;
  });
};

/**
 * Get led suit from current trick
 */
export const getLedSuit = (trick) => {
  if (!trick || trick.length === 0) return null;
  const firstCard = parseCard(trick[0].card || trick[0]);
  return firstCard ? firstCard.suit : null;
};

/**
 * Determine trick winner (highest card of led suit, or highest trump)
 */
export const determineTrickWinner = (trick, trumpSuit = 'S') => {
  if (!trick || trick.length === 0) return null;

  const ledSuit = getLedSuit(trick);
  let winningCard = trick[0];
  let winningPlayer = trick[0].player;

  const rankValues = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  for (const play of trick) {
    const card = parseCard(play.card);
    const winCard = parseCard(winningCard.card);
    
    if (!card || !winCard) continue;

    // Trump beats non-trump
    if (card.suit === trumpSuit && winCard.suit !== trumpSuit) {
      winningCard = play;
      winningPlayer = play.player;
    }
    // Higher trump beats lower trump
    else if (card.suit === trumpSuit && winCard.suit === trumpSuit) {
      if (rankValues[card.rank] > rankValues[winCard.rank]) {
        winningCard = play;
        winningPlayer = play.player;
      }
    }
    // Higher card of led suit (when no trump played)
    else if (card.suit === ledSuit && winCard.suit === ledSuit) {
      if (rankValues[card.rank] > rankValues[winCard.rank]) {
        winningCard = play;
        winningPlayer = play.player;
      }
    }
  }

  return { player: winningPlayer, card: winningCard };
};

/**
 * Count cards of a specific suit in hand
 */
export const countSuit = (hand, suit) => {
  return hand.filter(cardStr => {
    const card = parseCard(cardStr);
    return card && card.suit === suit;
  }).length;
};
