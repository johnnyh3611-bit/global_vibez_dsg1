import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PremiumCasinoCardLayout from '@/components/casino/PremiumCasinoCardLayout';

const GameState = {
  BETTING: '🎰 PLACE YOUR BETS',
  DECISION: '🤔 PLAY OR FOLD?',
  REVEAL: '🎴 REVEALING...',
  RESULT: 'RESULT'
};

export default function PracticeThreeCardPoker() {
  const [credits, setCredits] = useState(10000);
  const [ante, setAnte] = useState(0);
  const [pairPlus, setPairPlus] = useState(0);
  const [chipValue, setChipValue] = useState(100);
  const [gameState, setGameState] = useState(GameState.BETTING);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [winner, setWinner] = useState(null);

  const createHand = () => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return Array(3).fill(null).map(() => ({
      suit: suits[Math.floor(Math.random() * suits.length)],
      value: values[Math.floor(Math.random() * values.length)]
    }));
  };

  const placeBet = (type) => {
    if (gameState !== GameState.BETTING || credits < chipValue) return;
    
    if (type === 'ante') {
      setAnte(ante + chipValue);
      setCredits(credits - chipValue);
    } else if (type === 'pairplus') {
      setPairPlus(pairPlus + chipValue);
      setCredits(credits - chipValue);
    }
  };

  const dealCards = () => {
    if (gameState !== GameState.BETTING || (ante === 0 && pairPlus === 0)) return;
    
    setPlayerHand(createHand());
    setDealerHand([{ value: '?', suit: 'back' }, { value: '?', suit: 'back' }, { value: '?', suit: 'back' }]);
    setGameState(GameState.DECISION);
  };

  const playHand = () => {
    if (credits < ante) return;
    setCredits(credits - ante);
    setDealerHand(createHand());
    setGameState(GameState.REVEAL);
    
    setTimeout(() => {
      setWinner('PLAYER WINS');
      const payout = ante * 3 + pairPlus * 2;
      setCredits(c => c + payout);
      setGameState(GameState.RESULT);
      setTimeout(resetGame, 3000);
    }, 2000);
  };

  const foldHand = () => {
    resetGame();
  };

  const resetGame = () => {
    setGameState(GameState.BETTING);
    setPlayerHand([]);
    setDealerHand([]);
    setAnte(0);
    setPairPlus(0);
    setWinner(null);
  };

  const currentBet = ante + pairPlus;

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
      themeColor="purple"
    >
      <div className="space-y-3">
        {/* Betting Options */}
        {gameState === GameState.BETTING && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={() => placeBet('ante')}
              disabled={credits < chipValue}
              className="bg-gradient-to-r from-cyan-500/40 to-blue-500/40 border-2 border-cyan-400 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30 backdrop-blur-xl"
              whileHover={{ scale: 1.02 }}
            >
              🎴 ANTE ${ante || chipValue}
            </motion.button>
            <motion.button
              onClick={() => placeBet('pairplus')}
              disabled={credits < chipValue}
              className="bg-gradient-to-r from-yellow-500/40 to-orange-500/40 border-2 border-yellow-400 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30 backdrop-blur-xl"
              whileHover={{ scale: 1.02 }}
            >
              ⭐ PAIR+ ${pairPlus || chipValue}
            </motion.button>
          </div>
        )}

        {/* Decision Buttons */}
        {gameState === GameState.DECISION && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={foldHand}
              className="bg-gradient-to-r from-red-600/20 to-pink-600/20 border-2 border-red-400/50 text-white font-bold text-sm py-2.5 rounded-xl backdrop-blur-xl"
              whileHover={{ scale: 1.02 }}
            >
              🚫 FOLD
            </motion.button>
            <motion.button
              onClick={playHand}
              disabled={credits < ante}
              className="bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30"
              whileHover={{ scale: 1.02 }}
            >
              ▶️ PLAY (Match Ante)
            </motion.button>
          </div>
        )}

        {/* Deal Button */}
        {gameState === GameState.BETTING && (
          <motion.button
            onClick={dealCards}
            disabled={(ante === 0 && pairPlus === 0)}
            className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30"
            whileHover={{ scale: 1.02 }}
          >
            🎴 DEAL CARDS
          </motion.button>
        )}
        
        <div className="text-purple-300 text-[9px] text-center font-semibold tracking-wider">🃏 Three Card Poker - Ante & Play</div>
      </div>
    </PremiumCasinoCardLayout>
  );
}
