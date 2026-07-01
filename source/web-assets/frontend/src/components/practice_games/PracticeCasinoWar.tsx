import React, { useState } from 'react';
import { motion } from 'framer-motion';
import PremiumCasinoCardLayout from '@/components/casino/PremiumCasinoCardLayout';

const GameState = {
  BETTING: '🎰 PLACE YOUR BET',
  DEALING: '🎴 DEALING...',
  WAR_DECISION: '⚔️ WAR DECLARED!',
  WAR: '⚔️ GOING TO WAR...',
  RESULT: 'RESULT'
};

export default function PracticeCasinoWar() {
  const [credits, setCredits] = useState(10000);
  const [currentBet, setCurrentBet] = useState(0);
  const [chipValue, setChipValue] = useState(100);
  const [gameState, setGameState] = useState(GameState.BETTING);
  const [playerCard, setPlayerCard] = useState(null);
  const [dealerCard, setDealerCard] = useState(null);
  const [winner, setWinner] = useState(null);
  const [burnedCards, setBurnedCards] = useState(0);

  const createCard = () => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return {
      suit: suits[Math.floor(Math.random() * suits.length)],
      value: values[Math.floor(Math.random() * values.length)]
    };
  };

  const getCardValue = (card) => {
    const values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return values[card.value];
  };

  const placeBet = () => {
    if (gameState !== GameState.BETTING || credits < chipValue) return;
    setCurrentBet(currentBet + chipValue);
    setCredits(credits - chipValue);
  };

  const dealCards = () => {
    if (!currentBet || gameState !== GameState.BETTING) return;
    
    setGameState(GameState.DEALING);
    const pCard = createCard();
    const dCard = createCard();
    
    setTimeout(() => {
      setPlayerCard(pCard);
      setDealerCard(dCard);

      const pValue = getCardValue(pCard);
      const dValue = getCardValue(dCard);

      if (pValue > dValue) {
        setWinner('PLAYER WINS');
        setCredits(c => c + currentBet * 2);
        setGameState(GameState.RESULT);
        setTimeout(resetGame, 3000);
      } else if (pValue < dValue) {
        setWinner('DEALER WINS');
        setGameState(GameState.RESULT);
        setTimeout(resetGame, 3000);
      } else {
        setGameState(GameState.WAR_DECISION);
      }
    }, 1500);
  };

  const goToWar = () => {
    if (credits < currentBet) return;
    setCredits(credits - currentBet);
    setCurrentBet(currentBet * 2);
    setBurnedCards(3);
    setGameState(GameState.WAR);

    setTimeout(() => {
      const pCard = createCard();
      const dCard = createCard();
      setPlayerCard(pCard);
      setDealerCard(dCard);

      const pValue = getCardValue(pCard);
      const dValue = getCardValue(dCard);

      if (pValue >= dValue) {
        setWinner('PLAYER WINS');
        setCredits(c => c + currentBet * 2);
      } else {
        setWinner('DEALER WINS');
      }
      setGameState(GameState.RESULT);
      setTimeout(resetGame, 3000);
    }, 2000);
  };

  const surrender = () => {
    const refund = Math.floor(currentBet / 2);
    setCredits(credits + refund);
    resetGame();
  };

  const resetGame = () => {
    setGameState(GameState.BETTING);
    setPlayerCard(null);
    setDealerCard(null);
    setCurrentBet(0);
    setWinner(null);
    setBurnedCards(0);
  };

  return (
    <PremiumCasinoCardLayout
      credits={credits}
      currentBet={currentBet}
      gameState={gameState}
      winner={winner}
      dealerCards={dealerCard ? [dealerCard] : []}
      playerCards={playerCard ? [playerCard] : []}
      chipValue={chipValue}
      onChipSelect={setChipValue}
      themeColor="red"
      extraInfo={burnedCards > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-red-500/30 backdrop-blur-xl border-2 border-red-400 rounded-xl px-6 py-2"
        >
          <div className="text-white text-sm font-bold">🔥 {burnedCards} Cards Burned</div>
        </motion.div>
      )}
    >
      {/* Game-Specific Controls */}
      <div className="space-y-3">
        {/* War Decision Buttons */}
        {gameState === GameState.WAR_DECISION && (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={goToWar}
              disabled={credits < currentBet}
              className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30 shadow-[0_0_30px_rgba(255,0,0,0.5)]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              ⚔️ GO TO WAR (DOUBLE)
            </motion.button>
            <motion.button
              onClick={surrender}
              className="bg-gradient-to-r from-gray-600/20 to-gray-800/20 border-2 border-gray-400/50 text-white font-bold text-sm py-2.5 rounded-xl hover:border-gray-400 transition-all backdrop-blur-xl"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              🏳️ SURRENDER (HALF)
            </motion.button>
          </div>
        )}

        {/* Main Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            onClick={placeBet}
            disabled={gameState !== GameState.BETTING || credits < chipValue}
            className="bg-gradient-to-r from-orange-500/40 to-yellow-500/40 border-2 border-orange-400 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30 backdrop-blur-xl"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            💰 PLACE BET ${chipValue}
          </motion.button>
          <motion.button
            onClick={dealCards}
            disabled={gameState !== GameState.BETTING || !currentBet}
            className="bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 text-white font-bold text-sm py-2.5 rounded-xl disabled:opacity-30 shadow-[0_0_30px_rgba(255,0,0,0.5)]"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            🎴 DEAL CARDS
          </motion.button>
        </div>
        
        <div className="text-red-300 text-[9px] text-center font-semibold tracking-wider">⚔️ High card wins - Tie = WAR!</div>
      </div>
    </PremiumCasinoCardLayout>
  );
}
