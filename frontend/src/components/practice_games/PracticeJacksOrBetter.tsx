import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PremiumCasinoCardLayout from '@/components/casino/PremiumCasinoCardLayout';

const GameState = {
  BETTING: '🎰 PLACE YOUR BET',
  DEALT: '🎴 HOLD CARDS & DRAW',
  DRAWING: '🔄 DRAWING...',
  RESULT: 'RESULT'
};

export default function PracticeJacksOrBetter() {
  const [credits, setCredits] = useState(10000);
  const [currentBet, setCurrentBet] = useState(0);
  const [chipValue, setChipValue] = useState(100);
  const [gameState, setGameState] = useState(GameState.BETTING);
  const [playerHand, setPlayerHand] = useState([]);
  const [heldCards, setHeldCards] = useState(new Set());
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
    setCurrentBet(currentBet + chipValue);
    setCredits(credits - chipValue);
  };

  const dealCards = () => {
    if (gameState !== GameState.BETTING || currentBet === 0) return;
    
    setPlayerHand(createHand());
    setHeldCards(new Set());
    setGameState(GameState.DEALT);
  };

  const toggleHold = (index) => {
    const newHeld = new Set(heldCards);
    if (newHeld.has(index)) {
      newHeld.delete(index);
    } else {
      newHeld.add(index);
    }
    setHeldCards(newHeld);
  };

  const drawCards = () => {
    setGameState(GameState.DRAWING);
    
    const newHand = playerHand.map((card, i) => 
      heldCards.has(i) ? card : createHand()[0]
    );
    
    setTimeout(() => {
      setPlayerHand(newHand);
      setWinner('JACKS OR BETTER');
      setCredits(c => c + currentBet * 2);
      setGameState(GameState.RESULT);
      setTimeout(resetGame, 3000);
    }, 1500);
  };

  const resetGame = () => {
    setGameState(GameState.BETTING);
    setPlayerHand([]);
    setHeldCards(new Set());
    setCurrentBet(0);
    setWinner(null);
  };

  // Add custom card display with HOLD indicators
  const customPlayerCards = playerHand.map((card, i) => ({
    ...card,
    held: heldCards.has(i)
  }));

  return (
    <PremiumCasinoCardLayout
      credits={credits}
      currentBet={currentBet}
      gameState={gameState}
      winner={winner}
      dealerCards={[]}
      playerCards={playerHand}
      chipValue={chipValue}
      onChipSelect={setChipValue}
      themeColor="purple"
      dealerLabel="💰 PAYTABLE"
      playerLabel="🎴 YOUR HAND"
    >
      <div className="space-y-3">
        {/* Hold Cards */}
        {gameState === GameState.DEALT && (
          <div className="grid grid-cols-5 gap-2 mb-2">
            {playerHand.map((_, i) => (
              <motion.button
                key={`item-${i}`}
                onClick={() => toggleHold(i)}
                className={`py-1 rounded text-xs font-bold ${
                  heldCards.has(i) 
                    ? 'bg-yellow-500 text-black' 
                    : 'bg-gray-600/50 text-white border border-gray-400'
                }`}
                whileHover={{ scale: 1.05 }}
              >
                {heldCards.has(i) ? 'HELD' : 'HOLD'}
              </motion.button>
            ))}
          </div>
        )}

        {/* Draw Button */}
        {gameState === GameState.DEALT && (
          <motion.button
            onClick={drawCards}
            className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white font-bold text-sm py-2.5 rounded-xl"
            whileHover={{ scale: 1.02 }}
          >
            🔄 DRAW
          </motion.button>
        )}

        {/* Betting & Deal */}
        {gameState === GameState.BETTING && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={placeBet}
              disabled={credits < chipValue}
              className="bg-gradient-to-r from-purple-500/40 to-pink-500/40 border-2 border-purple-400 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30 backdrop-blur-xl"
              whileHover={{ scale: 1.02 }}
            >
              💰 PLACE BET ${chipValue}
            </motion.button>
            <motion.button
              onClick={dealCards}
              disabled={currentBet === 0}
              className="bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30"
              whileHover={{ scale: 1.02 }}
            >
              🎴 DEAL
            </motion.button>
          </div>
        )}
        
        <div className="text-purple-300 text-[9px] text-center font-semibold tracking-wider">🎰 Jacks or Better - Video Poker</div>
      </div>
    </PremiumCasinoCardLayout>
  );
}
