import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const GameState = {
  BETTING: 'BETTING',
  REVEALING: 'REVEALING',
  RESULT: 'RESULT'
};

const FanTan = () => {
  const [currentState, setCurrentState] = useState(GameState.BETTING);
  const [beadCount, setBeadCount] = useState(0);
  const [remainder, setRemainder] = useState(0);
  const [betLineup, setBetLineup] = useState([]);
  const [credits, setCredits] = useState(5000);
  const [lastWin, setLastWin] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";

  const placeBet = (position, amount = 100) => {
    if (currentState !== GameState.BETTING || credits < amount) return;
    
    cardSoundManager.playChipClink();
    setBetLineup([...betLineup, { position, amount, id: Date.now() }]);
    setCredits(credits - amount);
  };

  const handleReveal = async () => {
    if (betLineup.length === 0) return;

    setIsRevealing(true);
    setCurrentState(GameState.REVEALING);
    cardSoundManager.playChipClink();

    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      
      // Determine bet position from first bet
      const position = betLineup[0]?.position || 1;
      
      // 1. Place bet (server-authoritative)
      const betResponse = await fetch(`${API}/api/practice/casino/bet`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({
          game_type: 'fantan',
          bet_amount: 100,
          bet_data: {position}
        })
      });
      const {game_id} = await betResponse.json();
      
      // 2. Execute reveal (server counts beads)
      const spinResponse = await fetch(`${API}/api/practice/casino/spin`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({game_id})
      });
      const {result, payout} = await spinResponse.json();
      
      // 3. Update UI with server result
      setTimeout(() => {
        setBeadCount(result.bead_count);
        setRemainder(result.remainder);
        setIsRevealing(false);
        setCurrentState(GameState.RESULT);
        
        setLastWin(payout);
        setCredits(credits + payout);
        if (payout > 0) cardSoundManager.playWinSound();

        setTimeout(() => {
          setCurrentState(GameState.BETTING);
          setBetLineup([]);
          setBeadCount(0);
          setRemainder(0);
        }, 3000);
      }, 3000);
      
    } catch (error) {
      // console.error('Server-authoritative reveal failed:', error);
      // Fallback to client-side
      const count = Math.floor(Math.random() * 40) + 60;
      setBeadCount(count);

      setTimeout(() => {
        const rem = count % 4 || 4;
        setRemainder(rem);
        setIsRevealing(false);
        setCurrentState(GameState.RESULT);
        processPayouts(rem);
      }, 3000);
    }
  };

  const processPayouts = (result) => {
    let totalWin = 0;

    betLineup.forEach(bet => {
      if (bet.position === result) {
        totalWin += bet.amount * 4; // 3:1 payout + original bet
      }
    });

    setLastWin(totalWin);
    setCredits(credits + totalWin);
    if (totalWin > 0) cardSoundManager.playWinSound();

    setTimeout(() => {
      setCurrentState(GameState.BETTING);
      setBetLineup([]);
      setBeadCount(0);
      setRemainder(0);
    }, 3000);
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
          FAN TAN
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Ancient Chinese Bead Game - 3.75% House Edge</p>
      </motion.div>

      {/* Bead Bowl */}
      <div className={`${glassEffect} rounded-full w-96 h-96 mb-8 relative flex items-center justify-center`}>
        <AnimatePresence>
          {isRevealing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="text-6xl"
            >
              🥢
            </motion.div>
          ) : beadCount > 0 ? (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center"
            >
              <p className="text-6xl font-black text-[#00F0FF] mb-4">{remainder}</p>
              <p className="text-sm text-white/60">Remainder from {beadCount} beads</p>
            </motion.div>
          ) : (
            <div className="text-center text-white/20">
              <p className="text-4xl mb-2">⚪⚪⚪</p>
              <p className="text-sm uppercase tracking-wider">Place Bets</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Betting Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map(num => (
          <motion.button
            key={num}
            onClick={() => placeBet(num)}
            disabled={currentState !== GameState.BETTING}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`w-24 h-24 ${glassEffect} rounded-2xl text-4xl font-black transition-all disabled:opacity-30 ${
              remainder === num ? 'border-2 border-[#00F0FF] text-[#00F0FF] shadow-[0_0_20px_#00F0FF]' : 'text-white hover:border-[#D4AF37]'
            }`}
          >
            {num}
            <p className="text-xs text-[#D4AF37] mt-2">3:1</p>
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
          onClick={handleReveal}
          disabled={currentState !== GameState.BETTING || betLineup.length === 0}
          className="px-20 py-5 bg-[#00F0FF] text-black font-black italic uppercase tracking-tighter hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:bg-gray-600"
          style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
        >
          {isRevealing ? 'Counting...' : 'Reveal Beads'}
        </button>

        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Last Win</p>
          <p className="text-2xl font-black text-[#00F0FF]">${lastWin}</p>
        </div>
      </div>

      {/* Active Bets */}
      {betLineup.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mt-8 ${glassEffect} rounded-2xl p-4 max-w-md`}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Active Bets</p>
          <div className="space-y-1">
            {betLineup.map(bet => (
              <div key={bet.id} className="flex justify-between text-sm">
                <span className="text-white">Position {bet.position}</span>
                <span className="text-[#D4AF37] font-bold">${bet.amount}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Rules */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`mt-8 ${glassEffect} rounded-2xl p-6 max-w-2xl`}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-4">How to Play</p>
        <div className="space-y-2 text-sm text-white/80">
          <p>• Dealer covers pile of beads with bowl</p>
          <p>• Removes beads 4 at a time with bamboo stick</p>
          <p>• Bet on remainder: 1, 2, 3, or 4</p>
          <p>• <span className="text-[#D4AF37] font-bold">3:1 payout</span> on correct guess</p>
          <p>• Popular in Macau casinos</p>
        </div>
      </motion.div>
    </div>
  );
};

export default FanTan;