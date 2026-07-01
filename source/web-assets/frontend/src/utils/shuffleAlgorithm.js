// Fisher-Yates (Durstenfeld) Shuffle Algorithm
// Industry standard for unbiased card shuffling
// Used by professional casino platforms

/**
 * Shuffle an array using Fisher-Yates algorithm
 * Time Complexity: O(n)
 * Space Complexity: O(1)
 * Ensures uniform distribution (~1/52! for standard deck)
 */
export const fisherYatesShuffle = (array) => {
  const shuffled = [...array]; // Create copy to avoid mutation
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
};

/**
 * Create a standard 52-card deck
 * Format: "AS" = Ace of Spades, "10H" = 10 of Hearts, etc.
 */
export const createStandardDeck = (deckCount = 1) => {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  
  for (let d = 0; d < deckCount; d++) {
    suits.forEach(suit => {
      values.forEach(value => {
        deck.push({ value, suit, id: `${value}${suit[0].toUpperCase()}-${d}` });
      });
    });
  }
  
  return deck;
};

/**
 * Create shuffled deck (convenience function)
 */
export const createShuffledDeck = (deckCount = 1) => {
  return fisherYatesShuffle(createStandardDeck(deckCount));
};

/**
 * Deal cards to multiple players
 * @param {Array} deck - The deck to deal from
 * @param {number} playerCount - Number of players
 * @param {number} cardsPerPlayer - Cards to deal to each player
 * @returns {Object} { hands: [[cards]], remainingDeck: [cards] }
 */
export const dealCards = (deck, playerCount, cardsPerPlayer) => {
  const hands = Array.from({ length: playerCount }, () => []);
  let deckIndex = 0;
  
  // Deal clockwise: one card to each player, then repeat
  for (let round = 0; round < cardsPerPlayer; round++) {
    for (let player = 0; player < playerCount; player++) {
      if (deckIndex < deck.length) {
        hands[player].push(deck[deckIndex]);
        deckIndex++;
      }
    }
  }
  
  return {
    hands,
    remainingDeck: deck.slice(deckIndex)
  };
};

/**
 * Calculate card value for Blackjack
 */
export const getBlackjackValue = (card) => {
  if (card.value === 'A') return 11; // Ace (can be 1 or 11)
  if (['J', 'Q', 'K'].includes(card.value)) return 10;
  return parseInt(card.value);
};

/**
 * Calculate hand total for Blackjack
 */
export const calculateBlackjackTotal = (hand) => {
  let total = 0;
  let aces = 0;
  
  hand.forEach(card => {
    const value = getBlackjackValue(card);
    total += value;
    if (card.value === 'A') aces++;
  });
  
  // Adjust for Aces if bust
  while (total > 21 && aces > 0) {
    total -= 10; // Convert Ace from 11 to 1
    aces--;
  }
  
  return total;
};

/**
 * Calculate card value for Baccarat (0-9)
 */
export const getBaccaratValue = (card) => {
  if (['10', 'J', 'Q', 'K'].includes(card.value)) return 0;
  if (card.value === 'A') return 1;
  return parseInt(card.value);
};

/**
 * Calculate hand total for Baccarat (last digit only)
 */
export const calculateBaccaratTotal = (hand) => {
  const total = hand.reduce((sum, card) => sum + getBaccaratValue(card), 0);
  return total % 10; // Only last digit counts
};

export default {
  fisherYatesShuffle,
  createStandardDeck,
  createShuffledDeck,
  dealCards,
  getBlackjackValue,
  calculateBlackjackTotal,
  getBaccaratValue,
  calculateBaccaratTotal
};
