
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const GameState = {
  BETTING: 'BETTING',
  ROLLING: 'ROLLING',
  RESULT: 'RESULT'
};

const Klondike = () => {
  const [currentState, setCurrentState] = useState(GameState.BETTING);
  const [playerDice, setPlayerDice] = useState([1, 1, 1, 1, 1]);
  const [bankerDice, setBankerDice] = useState([1, 1, 1, 1, 1]);
  const [betAmount, setBetAmount] = useState(0);
  const [credits, setCredits] = useState(5000);
  const [lastWin, setLastWin] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";

  const rollDice = () => {
    return Array(5).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
  };

  const evaluateHand = (dice) => {
    const counts = dice.reduce((acc, d) => {
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});
    const values = (Object.values(counts) as number[]).sort((a, b) => b - a);
    
    if (values[0] === 5) return { rank: 7, label: 'Five of a Kind' };
    if (values[0] === 4) return { rank: 6, label: 'Four of a Kind' };
    if (values[0] === 3 && values[1] === 2) return { rank: 5, label: 'Full House' };
    if (values[0] === 3) return { rank: 4, label: 'Three of a Kind' };
    if (values[0] === 2 && values[1] === 2) return { rank: 3, label: 'Two Pair' };
    if (values[0] === 2) return { rank: 2, label: 'One Pair' };
    
    const sorted = [...dice].sort((a, b) => a - b);
    if (sorted.join('') === '12345' || sorted.join('') === '23456') {
      return { rank: 6, label: 'Straight' };
    }
    
    return { rank: 1, label: 'High Card' };
  };

  const handleRoll = () => {
    if (betAmount === 0) return;

    setIsRolling(true);
    setCurrentState(GameState.ROLLING);
    cardSoundManager.playChipClink();

    setTimeout(() => {
      const pDice = rollDice();
      const bDice = rollDice();
      
      setPlayerDice(pDice);
      setBankerDice(bDice);

      const pHand = evaluateHand(pDice);
      const bHand = evaluateHand(bDice);

      setIsRolling(false);
      setCurrentState(GameState.RESULT);

      if (pHand.rank > bHand.rank) {
        cardSoundManager.playWinSound();
        const winnings = betAmount * 2;
        setLastWin(winnings);
        setCredits(credits + winnings);
      } else if (pHand.rank === bHand.rank) {
        // Push
        setCredits(credits + betAmount);
        setLastWin(0);
      } else {
        cardSoundManager.playLoseSound();
        setLastWin(0);
      }

      setTimeout(() => {
        setCurrentState(GameState.BETTING);
        setBetAmount(0);
      }, 3000);
    }, 2000);
  };

  const placeBet = () => {
    if (currentState !== GameState.BETTING || credits < 100) return;
    
    cardSoundManager.playChipClink();
    setBetAmount(100);
    setCredits(credits - 100);
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
          KLONDIKE
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Five Dice Poker</p>
      </motion.div>

      {/* Banker Dice */}
      <div className={`${glassEffect} rounded-2xl p-8 mb-8 min-w-[600px]`}>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4 text-center">Banker</p>
        <div className="flex justify-center gap-4 mb-2">
          {bankerDice.map((d, i) => (
            <motion.div
              key={`b-${i}`}
              animate={isRolling ? { 
                rotateX: [0, 360],
                rotateY: [0, 360],
              } : {}}
              transition={{ duration: 2, repeat: isRolling ? Infinity : 0 }}
              className="w-16 h-16 bg-white rounded-lg flex items-center justify-center text-3xl font-black text-black shadow-xl"
            >
              {d}
            </motion.div>
          ))}
        </div>
        {currentState === GameState.RESULT && (
          <p className="text-center text-[#E63946] font-bold mt-2">{evaluateHand(bankerDice).label}</p>
        )}
      </div>

      {/* VS */}
      <div className="text-4xl font-black text-white/20 mb-8">VS</div>

      {/* Player Dice */}
      <div className={`${glassEffect} rounded-2xl p-8 mb-8 min-w-[600px]`}>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4 text-center">Player</p>
        <div className="flex justify-center gap-4 mb-2">
          {playerDice.map((d, i) => (
            <motion.div
              key={`p-${i}`}
              animate={isRolling ? { 
                rotateX: [0, 360],
                rotateY: [0, 360],
              } : {}}
              transition={{ duration: 2, repeat: isRolling ? Infinity : 0 }}
              className="w-16 h-16 bg-white rounded-lg flex items-center justify-center text-3xl font-black text-black shadow-xl"
            >
              {d}
            </motion.div>
          ))}
        </div>
        {currentState === GameState.RESULT && (
          <p className="text-center text-[#00F0FF] font-bold mt-2">{evaluateHand(playerDice).label}</p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-10">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        {betAmount === 0 && currentState === GameState.BETTING && (
          <button 
            onClick={placeBet}
            disabled={credits < 100}
            className="px-16 py-4 bg-white/10 text-white font-black uppercase border border-white/20 hover:bg-white/20 transition-all disabled:opacity-30"
            style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
          >
            Place Bet ($100)
          </button>
        )}

        {betAmount > 0 && currentState === GameState.BETTING && (
          <button 
            onClick={handleRoll}
            className="px-20 py-5 bg-[#00F0FF] text-black font-black italic uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all"
            style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
          >
            Roll All Dice
          </button>
        )}

        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Last Win</p>
          <p className="text-2xl font-black text-[#00F0FF]">${lastWin}</p>
        </div>
      </div>

      {/* Hand Rankings */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`mt-8 ${glassEffect} rounded-2xl p-6 max-w-md`}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">Hand Rankings</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-white/60">Five of a Kind</span><span className="text-[#D4AF37]">Highest</span></div>
          <div className="flex justify-between"><span className="text-white/60">Straight</span><span className="text-[#D4AF37]">—</span></div>
          <div className="flex justify-between"><span className="text-white/60">Four of a Kind</span><span className="text-[#D4AF37]">—</span></div>
          <div className="flex justify-between"><span className="text-white/60">Full House</span><span className="text-[#D4AF37]">—</span></div>
          <div className="flex justify-between"><span className="text-white/60">Three of a Kind</span><span className="text-[#D4AF37]">—</span></div>
          <div className="flex justify-between"><span className="text-white/60">Two Pair</span><span className="text-[#D4AF37]">—</span></div>
          <div className="flex justify-between"><span className="text-white/60">One Pair</span><span className="text-[#D4AF37]">Lowest</span></div>
        </div>
      </motion.div>
    </div>
  );
};

export default Klondike;