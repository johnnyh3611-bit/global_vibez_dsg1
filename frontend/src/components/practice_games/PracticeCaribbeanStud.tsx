import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PremiumCasinoCardLayout from '@/components/casino/PremiumCasinoCardLayout';

const GameState = {
  BETTING: '🎰 PLACE YOUR BETS',
  DECISION: '🤔 RAISE OR FOLD?',
  REVEAL: '🎴 REVEALING...',
  RESULT: 'RESULT'
};

export default function PracticeCaribbeanStud() {
  const [credits, setCredits] = useState(10000);
  const [ante, setAnte] = useState(0);
  const [chipValue, setChipValue] = useState(100);
  const [gameState, setGameState] = useState(GameState.BETTING);
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [winner, setWinner] = useState(null);

  const createHand = () => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return Array(5).fill(null).map(() => ({
      suit: suits[Math.floor(Math.random() * suits.length)],
      value: values[Math.floor(Math.random() * values.length)]
    }));
  };

  const placeBet = () => {
    if (gameState !== GameState.BETTING || credits < chipValue) return;
    setAnte(ante + chipValue);
    setCredits(credits - chipValue);
  };

  const dealCards = () => {
    if (gameState !== GameState.BETTING || ante === 0) return;
    
    const playerCards = createHand();
    const dealerCards = createHand();
    
    setPlayerHand(playerCards);
    setDealerHand([dealerCards[0], { value: '?', suit: 'back' }, { value: '?', suit: 'back' }, { value: '?', suit: 'back' }, { value: '?', suit: 'back' }]);
    setGameState(GameState.DECISION);
  };

  const raiseHand = () => {
    const raiseAmount = ante * 2;
    if (credits < raiseAmount) return;
    setCredits(credits - raiseAmount);
    
    setDealerHand(createHand());
    setGameState(GameState.REVEAL);
    
    setTimeout(() => {
      setWinner('PLAYER WINS');
      const payout = ante * 3 + raiseAmount * 2;
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
    setWinner(null);
  };

  return (
    <PremiumCasinoCardLayout
      credits={credits}
      currentBet={ante}
      gameState={gameState}
      winner={winner}
      dealerCards={dealerHand}
      playerCards={playerHand}
      chipValue={chipValue}
      onChipSelect={setChipValue}
      themeColor="cyan"
      dealerLabel="🏝️ DEALER"
      playerLabel="🎴 YOUR HAND"
    >
      <div className="space-y-3">
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
              onClick={raiseHand}
              disabled={credits < ante * 2}
              className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30"
              whileHover={{ scale: 1.02 }}
            >
              📈 RAISE (2x Ante)
            </motion.button>
          </div>
        )}

        {/* Betting & Deal */}
        {gameState === GameState.BETTING && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={placeBet}
              disabled={credits < chipValue}
              className="bg-gradient-to-r from-cyan-500/40 to-blue-500/40 border-2 border-cyan-400 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30 backdrop-blur-xl"
              whileHover={{ scale: 1.02 }}
            >
              💰 ANTE ${ante || chipValue}
            </motion.button>
            <motion.button
              onClick={dealCards}
              disabled={ante === 0}
              className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30"
              whileHover={{ scale: 1.02 }}
            >
              🎴 DEAL
            </motion.button>
          </div>
        )}
        
        <div className="text-cyan-300 text-[9px] text-center font-semibold tracking-wider">🏝️ Caribbean Stud Poker - Beat the Dealer</div>
      </div>
    </PremiumCasinoCardLayout>
  );
}
