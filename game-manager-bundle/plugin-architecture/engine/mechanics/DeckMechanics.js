/**
 * DeckMechanics.js - Universal Deck Operations
 * 
 * Atomic mechanics for card deck manipulation.
 * Used by ALL card games - never duplicated.
 * 
 * Operations:
 * - Create deck (standard, custom, special)
 * - Shuffle (Fisher-Yates algorithm)
 * - Deal cards to players
 * - Draw cards from deck
 * - Discard cards
 * - Reset deck
 */

/**
 * Standard 52-card deck
 */
const STANDARD_52 = {
  suits: ['hearts', 'diamonds', 'clubs', 'spades'],
  ranks: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'],
  colors: { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' }
};

/**
 * Standard deck values (for Blackjack, etc.)
 */
const CARD_VALUES = {
  'A': 11, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 10, 'Q': 10, 'K': 10
};

export const DeckMechanics = {
  /**
   * Create a new deck based on type
   */
  createDeck(type = 'standard_52') {
    switch (type) {
      case 'standard_52':
        return this.createStandard52();
      
      case 'jokers_54':
        return [...this.createStandard52(), ...this.createJokers()];
      
      case 'uno':
        return this.createUnoDeck();
      
      default:
        return this.createStandard52();
    }
  },
  
  /**
   * Create standard 52-card deck
   */
  createStandard52() {
    const cards = [];
    let id = 0;
    
    STANDARD_52.suits.forEach(suit => {
      STANDARD_52.ranks.forEach(rank => {
        cards.push({
          id: `card_${id++}`,
          suit,
          rank,
          value: CARD_VALUES[rank],
          color: STANDARD_52.colors[suit],
          face_state: 'down',
          location: 'deck',
          owner: null
        });
      });
    });
    
    return cards;
  },
  
  /**
   * Create 2 jokers
   */
  createJokers() {
    return [
      {
        id: 'joker_red',
        suit: null,
        rank: 'joker',
        value: 0,
        color: 'red',
        face_state: 'down',
        location: 'deck',
        owner: null
      },
      {
        id: 'joker_black',
        suit: null,
        rank: 'joker',
        value: 0,
        color: 'black',
        face_state: 'down',
        location: 'deck',
        owner: null
      }
    ];
  },
  
  /**
   * Create UNO deck (108 cards)
   */
  createUnoDeck() {
    const cards = [];
    const colors = ['red', 'blue', 'green', 'yellow'];
    const numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const actions = ['skip', 'reverse', 'draw_2'];
    let id = 0;
    
    // Number cards (2 of each except 0)
    colors.forEach(color => {
      cards.push({
        id: `uno_${id++}`,
        suit: null,
        rank: '0',
        value: 0,
        color,
        face_state: 'down',
        location: 'deck',
        owner: null
      });
      
      numbers.slice(1).forEach(num => {
        for (let i = 0; i < 2; i++) {
          cards.push({
            id: `uno_${id++}`,
            suit: null,
            rank: num,
            value: parseInt(num),
            color,
            face_state: 'down',
            location: 'deck',
            owner: null
          });
        }
      });
      
      // Action cards (2 of each per color)
      actions.forEach(action => {
        for (let i = 0; i < 2; i++) {
          cards.push({
            id: `uno_${id++}`,
            suit: null,
            rank: action,
            value: 20,
            color,
            face_state: 'down',
            location: 'deck',
            owner: null
          });
        }
      });
    });
    
    // Wild cards (4 of each)
    for (let i = 0; i < 4; i++) {
      cards.push({
        id: `uno_wild_${i}`,
        suit: null,
        rank: 'wild',
        value: 50,
        color: 'wild',
        face_state: 'down',
        location: 'deck',
        owner: null
      });
      
      cards.push({
        id: `uno_wild_draw_4_${i}`,
        suit: null,
        rank: 'wild_draw_4',
        value: 50,
        color: 'wild',
        face_state: 'down',
        location: 'deck',
        owner: null
      });
    }
    
    return cards;
  },
  
  /**
   * Fisher-Yates shuffle algorithm
   * Universally used for randomizing decks
   */
  shuffle(cards) {
    const shuffled = [...cards];
    
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled;
  },
  
  /**
   * Deal cards to players
   * Returns updated deck and hands
   */
  deal(deck, playerIds, cardsPerPlayer) {
    const hands = {};
    const remainingDeck = [...deck];
    
    playerIds.forEach(playerId => {
      hands[playerId] = [];
    });
    
    // Deal cards round-robin
    for (let i = 0; i < cardsPerPlayer; i++) {
      playerIds.forEach(playerId => {
        if (remainingDeck.length > 0) {
          const card = remainingDeck.shift();
          card.location = 'hand';
          card.owner = playerId;
          hands[playerId].push(card);
        }
      });
    }
    
    return { remainingDeck, hands };
  },
  
  /**
   * Draw cards from deck
   */
  draw(deck, count = 1) {
    if (deck.length < count) {
      throw new Error(`Not enough cards in deck. Requested: ${count}, Available: ${deck.length}`);
    }
    
    const drawnCards = deck.splice(0, count);
    drawnCards.forEach(card => {
      card.face_state = 'up';
      card.location = 'hand';
    });
    
    return { drawnCards, remainingDeck: deck };
  },
  
  /**
   * Discard card(s) to discard pile
   */
  discard(cards, discardPile) {
    const cardsArray = Array.isArray(cards) ? cards : [cards];
    
    cardsArray.forEach(card => {
      card.location = 'discard';
      card.face_state = 'up';
      card.owner = null;
    });
    
    return [...discardPile, ...cardsArray];
  },
  
  /**
   * Move card from one location to another
   */
  moveCard(card, fromLocation, toLocation, owner = null) {
    return {
      ...card,
      location: toLocation,
      owner
    };
  },
  
  /**
   * Flip card face up/down
   */
  flipCard(card, faceState = null) {
    return {
      ...card,
      face_state: faceState || (card.face_state === 'up' ? 'down' : 'up')
    };
  },
  
  /**
   * Reset deck (shuffle discard pile back into deck)
   */
  resetDeck(deck, discardPile, keepTopCard = true) {
    let cardsToShuffle = discardPile;
    let newDiscard = [];
    
    if (keepTopCard && discardPile.length > 0) {
      newDiscard = [discardPile[discardPile.length - 1]];
      cardsToShuffle = discardPile.slice(0, -1);
    }
    
    const resetCards = cardsToShuffle.map(card => ({
      ...card,
      location: 'deck',
      face_state: 'down',
      owner: null
    }));
    
    const newDeck = this.shuffle([...deck, ...resetCards]);
    
    return { deck: newDeck, discardPile: newDiscard };
  },
  
  /**
   * Get card display string (e.g., "A♠", "K♥")
   */
  getCardDisplay(card) {
    if (!card.suit) return card.rank;
    
    const suitSymbols = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠'
    };
    
    return `${card.rank}${suitSymbols[card.suit]}`;
  }
};

export default DeckMechanics;
