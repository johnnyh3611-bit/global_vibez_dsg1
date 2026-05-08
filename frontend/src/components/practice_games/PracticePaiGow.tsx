import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PremiumCasinoCardLayout from '@/components/casino/PremiumCasinoCardLayout';

const GameState = {
  BETTING: '🎰 PLACE YOUR BET',
  ARRANGING: '🀄 ARRANGE YOUR TILES',
  REVEAL: '🎴 REVEALING...',
  RESULT: 'RESULT'
};

export default function PracticePaiGow() {
  const [credits, setCredits] = useState(10000);
  const [currentBet, setCurrentBet] = useState(0);
  const [chipValue, setChipValue] = useState(100);
  const [gameState, setGameState] = useState(GameState.BETTING);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [winner, setWinner] = useState(null);

  const createHand = () => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return Array(7).fill(null).map(() => ({
      suit: suits[Math.floor(Math.random() * suits.length)],
      value: values[Math.floor(Math.random() * values.length)]
    }));
  };

  const placeBet = () => {
    if (gameState !== GameState.BETTING || credits < chipValue) return;
    setCurrentBet(currentBet + chipValue);
    setCredits(credits - chipValue);
  };

  const dealCards = () => {
    if (gameState !== GameState.BETTING || currentBet === 0) return;
    
    setPlayerHand(createHand());
    setDealerHand(createHand());
    setGameState(GameState.ARRANGING);
  };

  const setHands = () => {
    setGameState(GameState.REVEAL);
    
    setTimeout(() => {
      setWinner('PLAYER WINS');
      setCredits(c => c + currentBet * 2);
      setGameState(GameState.RESULT);
      setTimeout(resetGame, 3000);
    }, 2000);
  };

  const resetGame = () => {
    setGameState(GameState.BETTING);
    setPlayerHand([]);
    setDealerHand([]);
    setCurrentBet(0);
    setWinner(null);
  };

  return (
    <PremiumCasinoCardLayout
      credits={credits}
      currentBet={currentBet}
      gameState={gameState}
      winner={winner}
      dealerCards={dealerHand}
      playerCards={playerHand}
      chipValue={chipValue}
      onChipSelect={setChipValue}
      themeColor="yellow"
      dealerLabel="🀄 DEALER (7 TILES)"
      playerLabel="🎴 YOUR HAND (7 TILES)"
    >
      <div className="space-y-3">
        {/* Set Hands Button */}
        {gameState === GameState.ARRANGING && (
          <motion.button
            onClick={setHands}
            className="w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white font-bold text-sm py-2.5 rounded-xl"
            whileHover={{ scale: 1.02 }}
          >
            ✅ SET HANDS
          </motion.button>
        )}

        {/* Betting & Deal */}
        {gameState === GameState.BETTING && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={placeBet}
              disabled={credits < chipValue}
              className="bg-gradient-to-r from-yellow-500/40 to-orange-500/40 border-2 border-yellow-400 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30 backdrop-blur-xl"
              whileHover={{ scale: 1.02 }}
            >
              💰 PLACE BET ${chipValue}
            </motion.button>
            <motion.button
              onClick={dealCards}
              disabled={currentBet === 0}
              className="bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30"
              whileHover={{ scale: 1.02 }}
            >
              🎴 DEAL
            </motion.button>
          </div>
        )}
        
        <div className="text-yellow-300 text-[9px] text-center font-semibold tracking-wider">🀄 Pai Gow Poker - Split into 5-card & 2-card hands</div>
      </div>
    </PremiumCasinoCardLayout>
  );
}
