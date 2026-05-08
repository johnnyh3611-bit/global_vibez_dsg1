import React, { useState } from 'react';
import { motion } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const GameState = {
  SELECTING: 'SELECTING',
  DRAWING: 'DRAWING',
  RESULT: 'RESULT'
};

const Keno = () => {
  const [currentState, setCurrentState] = useState(GameState.SELECTING);
  const [selectedNumbers, setSelectedNumbers] = useState([]);
  const [drawnNumbers, setDrawnNumbers] = useState([]);
  const [credits, setCredits] = useState(5000);
  const [bet] = useState(10);
  const [lastWin, setLastWin] = useState(0);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";
  const maxPicks = 10;

  const PAYOUTS = {
    1: [0, 3],
    2: [0, 2, 12],
    3: [0, 1, 3, 45],
    4: [0, 0, 2, 5, 100],
    5: [0, 0, 1, 3, 15, 750],
    6: [0, 0, 0, 2, 5, 50, 1500],
    7: [0, 0, 0, 1, 3, 20, 100, 5000],
    8: [0, 0, 0, 0, 2, 10, 50, 500, 10000],
    9: [0, 0, 0, 0, 1, 5, 25, 200, 1000, 10000],
    10: [0, 0, 0, 0, 0, 2, 10, 50, 250, 2000, 10000]
  };

  const toggleNumber = (num) => {
    if (currentState !== GameState.SELECTING) return;

    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== num));
    } else if (selectedNumbers.length < maxPicks) {
      cardSoundManager.playChipClink();
      setSelectedNumbers([...selectedNumbers, num]);
    }
  };

  const handleDraw = () => {
    if (selectedNumbers.length === 0 || credits < bet) return;

    setCredits(credits - bet);
    setCurrentState(GameState.DRAWING);
    cardSoundManager.playCardShuffle();

    const drawn = [];
    while (drawn.length < 20) {
      const num = Math.floor(Math.random() * 80) + 1;
      if (!drawn.includes(num)) drawn.push(num);
    }

    setTimeout(() => {
      setDrawnNumbers(drawn);
      setCurrentState(GameState.RESULT);
      calculatePayout(drawn);
    }, 3000);
  };

  const calculatePayout = (drawn) => {
    const matches = selectedNumbers.filter(n => drawn.includes(n)).length;
    const picks = selectedNumbers.length;
    
    if (PAYOUTS[picks] && PAYOUTS[picks][matches]) {
      const winnings = bet * PAYOUTS[picks][matches];
      setLastWin(winnings);
      setCredits(credits + winnings);
      if (winnings > 0) cardSoundManager.playWinSound();
    }
  };

  const reset = () => {
    setCurrentState(GameState.SELECTING);
    setSelectedNumbers([]);
    setDrawnNumbers([]);
  };

  const matches = selectedNumbers.filter(n => drawnNumbers.includes(n)).length;

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
          KENO
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Pick 1-10 Numbers - 20-30% House Edge</p>
      </motion.div>

      {/* Number Grid */}
      <div className="grid grid-cols-10 gap-2 mb-8 max-w-4xl">
        {Array.from({ length: 80 }, (_, i) => i + 1).map(num => {
          const isSelected = selectedNumbers.includes(num);
          const isDrawn = drawnNumbers.includes(num);
          const isMatch = isSelected && isDrawn;

          return (
            <motion.button
              key={num}
              onClick={() => toggleNumber(num)}
              disabled={currentState !== GameState.SELECTING}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className={`w-12 h-12 rounded-lg font-bold text-sm transition-all disabled:cursor-not-allowed ${
                isMatch ? 'bg-[#00F0FF] text-black shadow-[0_0_15px_#00F0FF]' :
                isSelected ? 'bg-[#D4AF37] text-black' :
                isDrawn ? 'bg-white/20 text-white' :
                'bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:border-[#00F0FF]'
              }`}
            >
              {num}
            </motion.button>
          );
        })}
      </div>

      {/* Stats */}
      <div className={`${glassEffect} rounded-2xl p-6 mb-8 min-w-[600px]`}>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Picked</p>
            <p className="text-2xl font-black text-[#D4AF37]">{selectedNumbers.length}/10</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Drawn</p>
            <p className="text-2xl font-black text-white">{drawnNumbers.length}/20</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Matches</p>
            <p className="text-2xl font-black text-[#00F0FF]">{matches}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">Last Win</p>
            <p className="text-2xl font-black text-[#00F0FF]">${lastWin}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        {currentState === GameState.SELECTING && (
          <button 
            onClick={handleDraw}
            disabled={selectedNumbers.length === 0 || credits < bet}
            className="px-16 py-4 bg-[#00F0FF] text-black font-black uppercase disabled:opacity-30 disabled:bg-gray-600 transition-all hover:scale-105"
            style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
          >
            Draw 20 Numbers (${bet})
          </button>
        )}

        {currentState === GameState.RESULT && (
          <button 
            onClick={reset}
            className="px-16 py-4 bg-[#D4AF37] text-black font-black uppercase transition-all hover:scale-105"
            style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
          >
            New Game
          </button>
        )}
      </div>
    </div>
  );
};

export default Keno;