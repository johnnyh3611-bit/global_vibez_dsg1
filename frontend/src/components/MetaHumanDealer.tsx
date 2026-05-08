import React from 'react';
import HumanHolographicDealer from './casino/HumanHolographicDealer';

/**
 * Universal MetaHuman Dealer Component
 * Drop-in replacement for all AI dealers across the app
 * 
 * Usage:
 * <MetaHumanDealer 
 *   dealerType="nova" 
 *   gameState={gameState}
 *   onTipDealer={() => handleTip()}
 * />
 */

const GAME_PHRASES = {
  poker: {
    welcome: ["Welcome to the poker table", "Let's see your poker face", "Cards await, player"],
    dealing: ["Dealing the flop", "River card coming up", "And here's the turn"],
    playerWins: ["Excellent hand! You win!", "Winner at the poker table!", "Well played!"],
    playerLoses: ["Better luck next hand", "The cards weren't with you", "Try again, player"]
  },
  blackjack: {
    welcome: ["Welcome to blackjack", "Let's play 21", "Take your seat at blackjack"],
    dealing: ["Dealing your cards", "Here's your hand", "And the dealer shows..."],
    playerWins: ["21! Blackjack!", "You win this hand!", "Congratulations!"],
    playerLoses: ["Bust! Better luck next time", "Dealer wins", "House wins this round"]
  },
  roulette: {
    welcome: ["Place your bets", "Welcome to roulette", "Spin to win"],
    dealing: ["No more bets!", "And the ball lands on...", "Here we go!"],
    playerWins: ["Winner! Congratulations!", "You hit it!", "What a win!"],
    playerLoses: ["Better luck next spin", "Try again", "Next spin could be yours"]
  },
  slots: {
    welcome: ["Welcome to slots", "Feeling lucky?", "Let's spin"],
    dealing: ["Spinning the reels", "Here we go!", "And the result is..."],
    playerWins: ["JACKPOT!", "Big win!", "You're on fire!"],
    playerLoses: ["Almost! Try again", "Next spin", "Keep playing!"]
  },
  baccarat: {
    welcome: ["Welcome to baccarat", "Player or banker?", "Place your bets"],
    dealing: ["Dealing the cards", "Let's see the hands", "And the winner is..."],
    playerWins: ["Player wins!", "Excellent choice!", "Congratulations!"],
    playerLoses: ["Banker wins", "Better luck next hand", "Try again"]
  },
  default: {
    welcome: ["Welcome to the table", "Let's play", "Good luck!"],
    dealing: ["Dealing now", "Here we go", "Let's see the result"],
    playerWins: ["You win!", "Congratulations!", "Well done!"],
    playerLoses: ["Better luck next time", "Try again", "Keep playing!"]
  }
};

interface MetaHumanDealerProps {
  dealerType?: string;
  gameType?: string;
  gameState?: Record<string, any>;
  onTipDealer?: (() => void) | null;
  size?: string;
  className?: string;
  phrase?: string;
  mood?: string;
  isAnimating?: boolean;
  isDealing?: boolean;
  isShuffling?: boolean;
  isCelebrating?: boolean;
}

export default function MetaHumanDealer({
  dealerType = "nova",
  gameType = "default",
  gameState = {},
  onTipDealer,
  size = "normal",
  className = ""
}: MetaHumanDealerProps) {
  // Determine dealer mood based on game state
  const getMood = () => {
    if (gameState.playerWon) return "celebrating";
    if (gameState.isDealing) return "professional";
    if (gameState.bigWin) return "excited";
    if (gameState.playerLost) return "sympathetic";
    return "professional";
  };

  // Get appropriate phrase based on game state
  const getPhrase = () => {
    const phrases = GAME_PHRASES[gameType] || GAME_PHRASES.default;
    
    if (gameState.isDealing) {
      return phrases.dealing[Math.floor(Math.random() * phrases.dealing.length)];
    }
    if (gameState.playerWon) {
      return phrases.playerWins[Math.floor(Math.random() * phrases.playerWins.length)];
    }
    if (gameState.playerLost) {
      return phrases.playerLoses[Math.floor(Math.random() * phrases.playerLoses.length)];
    }
    return phrases.welcome[Math.floor(Math.random() * phrases.welcome.length)];
  };

  return (
    <div className={className}>
      <HumanHolographicDealer
        dealerType={dealerType}
        phrase={getPhrase()}
        mood={getMood()}
        isAnimating={gameState.isDealing || gameState.isShuffling}
        isDealing={gameState.isDealing}
        isShuffling={gameState.isShuffling}
        isCelebrating={gameState.playerWon || gameState.bigWin}
        onTipDealer={onTipDealer}
        size={size}
      />
    </div>
  );
}

// Export dealer types for easy reference
export const DEALER_TYPES = {
  NOVA: "nova",    // African male - professional, confident
  ACE: "ace",      // Asian male - analytical, precise
  RUBY: "ruby",    // Latina female - warm, encouraging
  JADE: "jade"     // Mixed female - cool, strategic
};

// Export game types
export const GAME_TYPES = {
  POKER: "poker",
  BLACKJACK: "blackjack",
  ROULETTE: "roulette",
  SLOTS: "slots",
  BACCARAT: "baccarat"
};
