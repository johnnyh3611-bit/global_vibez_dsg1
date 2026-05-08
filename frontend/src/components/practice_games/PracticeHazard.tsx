import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const GameState = {
  BETTING_OPEN: 'BETTING_OPEN',
  MAIN_ROLL: 'MAIN_ROLL',
  CHANCE_ROLL: 'CHANCE_ROLL',
  RESULT_REVEAL: 'RESULT_REVEAL'
};

const Hazard = () => {
  const [currentState, setCurrentState] = useState(GameState.BETTING_OPEN);
  const [phase, setPhase] = useState('MAIN'); // MAIN or CHANCE
  const [main, setMain] = useState(null);
  const [chance, setChance] = useState(null);
  const [dice, setDice] = useState([1, 1]);
  const [credits, setCredits] = useState(5000);
  const [betAmount, setBetAmount] = useState(0);
  const [lastWin, setLastWin] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";

  const handleRoll = () => {
    if (betAmount === 0) return;

    setIsRolling(true);
    setCurrentState(phase === 'MAIN' ? GameState.MAIN_ROLL : GameState.CHANCE_ROLL);
    cardSoundManager.playChipClink();

    setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      
      setDice([d1, d2]);
      processHazard(total);
      setIsRolling(false);
    }, 1000);
  };

  const processHazard = (total) => {
    if (phase === 'MAIN') {
      if (total === main) {
        // WIN_NICK - Player wins on first roll matching their chosen Main
        cardSoundManager.playWinSound();
        setLastWin(betAmount * 2);
        setCredits(credits + betAmount * 2);
        setTimeout(resetGame, 2000);
      } else if (total === 2 || total === 3) {
        // LOSE_OUT - Craps on Main
        cardSoundManager.playLoseSound();
        setTimeout(resetGame, 2000);
      } else if (main === 5 && (total === 11 || total === 12)) {
        // Special Out rules for Main of 5
        cardSoundManager.playLoseSound();
        setTimeout(resetGame, 2000);
      } else if (main === 6 && total === 12) {
        // Special Out rules for Main of 6
        cardSoundManager.playLoseSound();
        setTimeout(resetGame, 2000);
      } else if (main === 7 && (total === 11 || total === 12)) {
        // Special Out rules for Main of 7
        cardSoundManager.playLoseSound();
        setTimeout(resetGame, 2000);
      } else if (main === 8 && total === 12) {
        // Special Out rules for Main of 8
        cardSoundManager.playLoseSound();
        setTimeout(resetGame, 2000);
      } else if (main === 9 && (total === 11 || total === 12)) {
        // Special Out rules for Main of 9
        cardSoundManager.playLoseSound();
        setTimeout(resetGame, 2000);
      } else {
        // Set Chance and move to Chance phase
        setChance(total);
        setPhase('CHANCE');
        setCurrentState(GameState.BETTING_OPEN);
      }
    } else {
      // CHANCE phase
      if (total === chance) {
        // WIN - Player threw their Chance
        cardSoundManager.playWinSound();
        setLastWin(betAmount * 2);
        setCredits(credits + betAmount * 2);
        setTimeout(resetGame, 2000);
      } else if (total === main) {
        // LOSE - Player threw the Main
        cardSoundManager.playLoseSound();
        setTimeout(resetGame, 2000);
      } else {
        // Continue rolling
        setCurrentState(GameState.BETTING_OPEN);
      }
    }
  };

  const placeBet = (mainValue) => {
    if (currentState !== GameState.BETTING_OPEN || phase !== 'MAIN') return;
    
    const amount = 100;
    if (credits < amount) return;

    cardSoundManager.playChipClink();
    setMain(mainValue);
    setBetAmount(amount);
    setCredits(credits - amount);
  };

  const resetGame = () => {
    setPhase('MAIN');
    setMain(null);
    setChance(null);
    setBetAmount(0);
    setCurrentState(GameState.BETTING_OPEN);
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
          HAZARD
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">The Original Craps - Est. 14th Century</p>
      </motion.div>

      {/* Game State Display */}
      <div className={`${glassEffect} rounded-2xl p-6 mb-8 min-w-[600px]`}>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Phase</p>
            <p className={`text-2xl font-black ${phase === 'MAIN' ? 'text-[#00F0FF]' : 'text-[#D4AF37]'}`}>
              {phase}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Main</p>
            <p className="text-2xl font-black text-white">{main || '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Chance</p>
            <p className="text-2xl font-black text-[#00F0FF]">{chance || '—'}</p>
          </div>
        </div>
      </div>

      {/* Dice Display */}
      <div className="flex gap-12 mb-8">
        {dice.map((d, i) => (
          <motion.div
            key={`${i}-${d}`}
            animate={isRolling ? { rotate: [0, 90, 180, 270, 360], y: [0, -50, 0] } : {}}
            transition={{ duration: 1, repeat: isRolling ? Infinity : 0 }}
            className="w-24 h-24 bg-white rounded-xl flex items-center justify-center text-5xl font-black text-black shadow-2xl"
          >
            {d}
          </motion.div>
        ))}
      </div>

      {/* Main Selection (Only in MAIN phase before bet) */}
      {phase === 'MAIN' && !main && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8"
        >
          <p className="text-center text-white/60 text-sm uppercase tracking-[0.2em] mb-4">Choose Your Main</p>
          <div className="flex gap-4">
            {[5, 6, 7, 8, 9].map(num => (
              <motion.button
                key={num}
                onClick={() => placeBet(num)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className={`w-16 h-16 ${glassEffect} rounded-xl text-2xl font-black text-white hover:border-[#00F0FF] transition-all`}
              >
                {num}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-10">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        <button 
          onClick={handleRoll}
          disabled={isRolling || betAmount === 0}
          className="px-20 py-5 bg-[#00F0FF] text-black font-black italic uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:bg-gray-600"
          style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
        >
          {isRolling ? 'Rolling...' : phase === 'MAIN' ? 'Throw Main' : 'Throw Chance'}
        </button>

        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Last Win</p>
          <p className="text-2xl font-black text-[#00F0FF]">${lastWin}</p>
        </div>
      </div>

      {/* Rules Display */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`mt-8 ${glassEffect} rounded-2xl p-6 max-w-2xl`}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">Hazard Rules</p>
        <div className="space-y-2 text-sm text-white/80">
          <p><span className="text-[#00F0FF] font-bold">Main Phase:</span> Choose a Main (5-9), then throw.</p>
          <p><span className="text-[#D4AF37] font-bold">Nick:</span> Throw your Main = Instant Win!</p>
          <p><span className="text-[#E63946] font-bold">Out:</span> 2, 3, or specific numbers for each Main = Lose.</p>
          <p><span className="text-[#00F0FF] font-bold">Chance Phase:</span> Throw your Chance to win, or Main to lose.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Hazard;
