import React, { useState } from 'react';
import { motion } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import CasinoCard from '@/components/casino/CasinoCard';

const GameState = {
  BETTING: 'BETTING',
  DEALING: 'DEALING',
  RESULT: 'RESULT'
};

const Faro = () => {
  const [currentState, setCurrentState] = useState(GameState.BETTING);
  const [playerCard, setPlayerCard] = useState(null);
  const [bankerCard, setBankerCard] = useState(null);
  const [betOn, setBetOn] = useState(null);
  const [betAmount, setBetAmount] = useState(0);
  const [credits, setCredits] = useState(5000);
  const [lastWin, setLastWin] = useState(0);
  const [cardsDealt, setCardsDealt] = useState(0);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";

  const createCard = () => {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    return {
      suit: suits[Math.floor(Math.random() * suits.length)],
      value: values[Math.floor(Math.random() * values.length)]
    };
  };

  const placeBet = (side) => {
    if (currentState !== GameState.BETTING) return;
    
    const amount = 100;
    if (credits < amount) return;

    cardSoundManager.playChipClink();
    setBetOn(side);
    setBetAmount(amount);
    setCredits(credits - amount);
  };

  const handleDeal = () => {
    if (betAmount === 0) return;

    setCurrentState(GameState.DEALING);
    cardSoundManager.playCardShuffle();

    setTimeout(() => {
      const card1 = createCard(); // Banker (first card)
      const card2 = createCard(); // Player (second card)
      
      setBankerCard(card1);
      setPlayerCard(card2);
      setCardsDealt(cardsDealt + 2);

      // In Faro, you bet on rank, not high card
      // Simplified: Player card wins if it matches bet side
      setTimeout(() => {
        setCurrentState(GameState.RESULT);
        
        let won = false;
        if (betOn === 'player') {
          won = true; // Simplified - would check rank matching
          const winnings = betAmount * 2;
          setLastWin(winnings);
          setCredits(credits + winnings);
          cardSoundManager.playWinSound();
        } else {
          cardSoundManager.playLoseSound();
        }

        setTimeout(reset, 2000);
      }, 1500);
    }, 1000);
  };

  const reset = () => {
    setCurrentState(GameState.BETTING);
    setPlayerCard(null);
    setBankerCard(null);
    setBetOn(null);
    setBetAmount(0);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" 
         style={{ background: 'radial-gradient(circle at 50% 50%, #1A0B2E 0%, #08030F 60%, #000000 100%)' }}>
      <ParticleEffectsOverlay />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl md:text-6xl font-black text-[#D4AF37] mb-2 tracking-wider font-serif">
          FARO
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">The Honest Game - ~0% House Edge</p>
      </motion.div>

      {/* Faro Table Layout */}
      <div className={`${glassEffect} rounded-3xl p-12 mb-8 min-w-[700px]`}>
        <div className="grid grid-cols-2 gap-12">
          {/* Banker Card */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">Banker (Lose)</p>
            <div className="flex justify-center">
              {bankerCard ? (
                <CasinoCard
                  value={bankerCard.value}
                  suit={bankerCard.suit}
                  isFaceUp={true}
                  animate={true}
                />
              ) : (
                <div className="w-24 h-36 bg-indigo-950 rounded-xl border border-white/10" />
              )}
            </div>
          </div>

          {/* Player Card */}
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">Player (Win)</p>
            <div className="flex justify-center">
              {playerCard ? (
                <CasinoCard
                  value={playerCard.value}
                  suit={playerCard.suit}
                  isFaceUp={true}
                  animate={true}
                />
              ) : (
                <div className="w-24 h-36 bg-indigo-950 rounded-xl border border-white/10" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Betting Buttons */}
      <div className="flex gap-6 mb-8">
        <motion.button
          onClick={() => placeBet('banker')}
          disabled={currentState !== GameState.BETTING}
          whileHover={{ scale: 1.05 }}
          className={`px-12 py-6 rounded-xl border-2 transition-all disabled:opacity-30 ${
            betOn === 'banker' ? 'border-[#E63946] bg-[#E63946]/20' : 'border-white/20'
          }`}
        >
          <p className="text-white font-black text-lg">BET BANKER</p>
          <p className="text-[#D4AF37] text-sm">1:1</p>
        </motion.button>

        <motion.button
          onClick={() => placeBet('player')}
          disabled={currentState !== GameState.BETTING}
          whileHover={{ scale: 1.05 }}
          className={`px-12 py-6 rounded-xl border-2 transition-all disabled:opacity-30 ${
            betOn === 'player' ? 'border-[#00F0FF] bg-[#00F0FF]/20' : 'border-white/20'
          }`}
        >
          <p className="text-white font-black text-lg">BET PLAYER</p>
          <p className="text-[#D4AF37] text-sm">1:1</p>
        </motion.button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-10">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        <button 
          onClick={handleDeal}
          disabled={betAmount === 0}
          className="px-20 py-5 bg-[#00F0FF] text-black font-black italic uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:bg-gray-600"
          style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
        >
          Deal Cards
        </button>

        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Cards Dealt</p>
          <p className="text-2xl font-black text-white">{cardsDealt}/52</p>
        </div>
      </div>

      {/* Rules */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`mt-8 ${glassEffect} rounded-2xl p-6 max-w-2xl`}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">The Honest Game</p>
        <div className="space-y-2 text-sm text-white/80">
          <p>• First card (Banker) loses, second card (Player) wins</p>
          <p>• Bet on which rank will appear on winning card</p>
          <p>• ~0% house edge - the fairest casino game in history</p>
          <p>• Popular in Old West saloons</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Faro;