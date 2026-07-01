/**
 * Dealer Voice/Commentary System
 * Provides text-based dealer messages for game events
 * BACKWARD COMPATIBLE with legacy components
 */

export const dealerMessages = {
  welcome: [
    "Welcome to the table!",
    "Good luck!",
    "Let's play some Blackjack!",
    "Place your bets, please."
  ],
  
  dealerShowsAce: [
    "Dealer shows an Ace. Insurance?",
    "Would you like insurance?",
    "Ace showing - insurance available."
  ],
  
  playerBlackjack: [
    "Blackjack! Nice hand!",
    "🎰 BLACKJACK! Well played!",
    "Natural 21! Congratulations!"
  ],
  
  dealerBlackjack: [
    "Dealer Blackjack.",
    "House wins with Blackjack.",
    "Dealer has 21."
  ],
  
  playerBust: [
    "Bust! Over 21.",
    "Too many. House wins.",
    "That's a bust."
  ],
  
  dealerBust: [
    "Dealer busts! You win!",
    "Over 21. Players win!",
    "Dealer busted!"
  ],
  
  playerWin: [
    "You win!",
    "Winner!",
    "Congratulations!",
    "Nice win!"
  ],
  
  playerLoss: [
    "House wins.",
    "Better luck next time.",
    "Dealer wins."
  ],
  
  push: [
    "Push - it's a tie.",
    "Same value. Push.",
    "Tie game."
  ],
  
  goodHit: [
    "Good card!",
    "Nice hit!",
    "Solid play."
  ],
  
  riskyHit: [
    "Risky move...",
    "Careful now...",
    "Bold choice."
  ],
  
  shuffling: [
    "Shuffling the deck...",
    "New shuffle.",
    "Fresh deck coming up."
  ]
};

export const getDealerMessage = (eventType) => {
  const messages = dealerMessages[eventType] || [];
  return messages[Math.floor(Math.random() * messages.length)] || '';
};

// Legacy compatibility - for backward compatibility with old components
export const DealerCallouts = dealerMessages;

const dealerVoice = {
  getMessage: getDealerMessage,
  messages: dealerMessages,
  DealerCallouts: dealerMessages
};

export default dealerVoice;
