import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const GameState = {
  BETTING_OPEN: 'BETTING_OPEN',
  COME_OUT: 'COME_OUT',
  POINT_PHASE: 'POINT_PHASE',
  ROLLING: 'ROLLING',
  RESULT_REVEAL: 'RESULT_REVEAL'
};

const Craps = () => {
  const [currentState, setCurrentState] = useState(GameState.BETTING_OPEN);
  const [betLineup, setBetLineup] = useState([]);
  const [point, setPoint] = useState(null);
  const [dice, setDice] = useState([1, 1]);
  const [credits, setCredits] = useState(5000);
  const [lastWin, setLastWin] = useState(0);
  const [isRolling, setIsRolling] = useState(false);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";
  const neonCyan = "#00F0FF";
  const gold = "#D4AF37";

  const handleRoll = async () => {
    if (betLineup.length === 0) return;
    
    setIsRolling(true);
    setCurrentState(GameState.ROLLING);
    cardSoundManager.playChipClink();

    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      
      // 1. Place bet (server-authoritative)
      const betResponse = await fetch(`${API}/api/practice/casino/bet`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({
          game_type: 'craps',
          bet_amount: 100,
          bet_data: {bet_type: 'pass'}
        })
      });
      const {game_id} = await betResponse.json();
      
      // 2. Execute roll (server generates dice)
      const spinResponse = await fetch(`${API}/api/practice/casino/spin`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({game_id})
      });
      const {result, payout} = await spinResponse.json();
      
      // 3. Update UI with server result
      setTimeout(() => {
        setDice(result.dice);
        processCrapsLogic(result.total, payout);
        setIsRolling(false);
      }, 1000);
      
    } catch (error) {
      // console.error('Server-authoritative roll failed:', error);
      // Fallback to client-side for demo (remove in production)
      setTimeout(() => {
        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        setDice([d1, d2]);
        processCrapsLogic(d1 + d2, 0);
        setIsRolling(false);
      }, 1000);
    }
  };

  const processCrapsLogic = (total, payout = 0) => {
    // Update credits with server payout
    if (payout > 0) {
      setCredits(prev => prev + payout);
      setLastWin(payout);
    }
    
    if (point === null) {
      // COME OUT ROLL
      if ([7, 11].includes(total)) {
        cardSoundManager.playWinSound();
        setTimeout(() => setCurrentState(GameState.BETTING_OPEN), 2000);
      } else if ([2, 3, 12].includes(total)) {
        cardSoundManager.playLoseSound();
        setCredits(prev => prev - 100); // Deduct bet
        setTimeout(() => setCurrentState(GameState.BETTING_OPEN), 2000);
      } else {
        setPoint(total);
        setCurrentState(GameState.POINT_PHASE);
        setTimeout(() => setCurrentState(GameState.BETTING_OPEN), 2000);
      }
    } else {
      // POINT PHASE
      if (total === point) {
        cardSoundManager.playWinSound();
        setPoint(null);
        setTimeout(() => setCurrentState(GameState.BETTING_OPEN), 2000);
      } else if (total === 7) {
        cardSoundManager.playLoseSound();
        setCredits(prev => prev - 100); // Deduct bet
        setPoint(null);
        setTimeout(() => setCurrentState(GameState.BETTING_OPEN), 2000);
      } else {
        setTimeout(() => setCurrentState(GameState.BETTING_OPEN), 1000);
      }
    }
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
          CRAPS
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">The Mirror Table</p>
      </motion.div>

      {/* 🎰 THE MIRROR TABLE */}
      <div className={`relative w-full max-w-5xl aspect-video ${glassEffect} rounded-[100px] border-2 border-white/5 flex flex-col items-center overflow-hidden`}>
        
        {/* Point Marker Overlay */}
        <div className="absolute top-12 flex gap-4">
          <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center font-black ${point ? 'border-[#00F0FF] text-[#00F0FF] shadow-[0_0_15px_#00F0FF]' : 'border-white/20 text-white/20'}`}>
            {point || 'OFF'}
          </div>
        </div>

        {/* Dice Visualization */}
        <div className="flex gap-12 mt-32">
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

        {/* Simplified Betting Grid */}
        <div className="grid grid-cols-4 gap-4 w-full px-20 mt-20">
          {['Pass Line', 'Field', 'Big 6', 'Big 8'].map((bet) => (
            <button 
              key={bet}
              className={`h-24 ${glassEffect} hover:border-[#00F0FF] transition-all text-white font-bold uppercase tracking-widest text-sm`}
              style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0 100%)' }}
              onClick={() => setBetLineup([...betLineup, { type: bet, amount: 25 }])}
            >
              {bet}
            </button>
          ))}
        </div>
      </div>

      {/* Control Panel */}
      <div className="mt-8 flex items-center gap-10">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Bankroll</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        <button 
          onClick={handleRoll}
          disabled={isRolling}
          className="px-20 py-5 bg-[#00F0FF] text-black font-black italic uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:bg-gray-600"
          style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
        >
          {isRolling ? 'Rolling...' : 'Throw Dice'}
        </button>
      </div>
    </div>
  );
};

export default Craps;
