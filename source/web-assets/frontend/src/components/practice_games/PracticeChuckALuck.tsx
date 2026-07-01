import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const GameState = {
  BETTING_OPEN: 'BETTING_OPEN',
  ROLLING: 'ROLLING',
  RESULT_REVEAL: 'RESULT_REVEAL'
};

const ChuckALuck = () => {
  const [currentState, setCurrentState] = useState(GameState.BETTING_OPEN);
  const [dice, setDice] = useState([1, 1, 1]);
  const [betLineup, setBetLineup] = useState([]);
  const [credits, setCredits] = useState(5000);
  const [lastWin, setLastWin] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";

  const handleRoll = () => {
    if (betLineup.length === 0) return;

    setIsRolling(true);
    setCurrentState(GameState.ROLLING);
    cardSoundManager.playChipClink();

    setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const d3 = Math.floor(Math.random() * 6) + 1;
      
      setDice([d1, d2, d3]);
      processPayouts([d1, d2, d3]);
      setIsRolling(false);
      setCurrentState(GameState.RESULT_REVEAL);

      setTimeout(() => {
        setCurrentState(GameState.BETTING_OPEN);
        setBetLineup([]);
      }, 3000);
    }, 1500);
  };

  const processPayouts = (result) => {
    let totalWin = 0;

    betLineup.forEach(bet => {
      const count = result.filter(d => d === bet.value).length;
      
      if (count === 1) {
        totalWin += bet.amount * 2; // 1:1
      } else if (count === 2) {
        totalWin += bet.amount * 3; // 2:1
      } else if (count === 3) {
        totalWin += bet.amount * 4; // 3:1
      }
    });

    setLastWin(totalWin);
    setCredits(credits + totalWin);
    if (totalWin > 0) cardSoundManager.playWinSound();
  };

  const placeBet = (num) => {
    if (isRolling || credits < 25) return;
    
    cardSoundManager.playChipClink();
    setBetLineup([...betLineup, { value: num, amount: 25, id: Date.now() }]);
    setCredits(credits - 25);
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
          CHUCK-A-LUCK
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Three Dice - 7.8% House Edge</p>
      </motion.div>

      {/* Dice Cage Visual */}
      <div className={`${glassEffect} rounded-3xl p-12 mb-8 relative overflow-hidden`}>
        <div className="flex gap-8">
          {dice.map((d, i) => (
            <motion.div
              key={`${i}-${d}`}
              animate={isRolling ? { 
                rotateX: [0, 360, 720],
                rotateY: [0, 360, 720],
                y: [0, -30, 0]
              } : {}}
              transition={{ duration: 1.5, repeat: isRolling ? Infinity : 0 }}
              className="w-24 h-24 bg-white rounded-xl flex items-center justify-center text-5xl font-black text-black shadow-2xl"
            >
              {d}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Betting Grid */}
      <div className="grid grid-cols-6 gap-4 mb-8">
        {[1, 2, 3, 4, 5, 6].map(num => (
          <motion.button
            key={num}
            onClick={() => placeBet(num)}
            disabled={isRolling}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`w-20 h-20 ${glassEffect} rounded-xl text-3xl font-black text-white hover:border-[#00F0FF] transition-all disabled:opacity-30`}
          >
            {num}
          </motion.button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-10">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        <button 
          onClick={handleRoll}
          disabled={isRolling || betLineup.length === 0}
          className="px-20 py-5 bg-[#00F0FF] text-black font-black italic uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:bg-gray-600"
          style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
        >
          {isRolling ? 'Rolling...' : 'Roll Cage'}
        </button>

        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Last Win</p>
          <p className="text-2xl font-black text-[#00F0FF]">${lastWin}</p>
        </div>
      </div>

      {/* Payout Table */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`mt-8 ${glassEffect} rounded-2xl p-6 max-w-md`}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">Payouts</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-white/60">1 Match</span><span className="text-[#D4AF37]">1:1</span></div>
          <div className="flex justify-between"><span className="text-white/60">2 Matches</span><span className="text-[#D4AF37]">2:1</span></div>
          <div className="flex justify-between"><span className="text-white/60">3 Matches (Trips!)</span><span className="text-[#00F0FF] font-bold">3:1</span></div>
        </div>
      </motion.div>
    </div>
  );
};

export default ChuckALuck;