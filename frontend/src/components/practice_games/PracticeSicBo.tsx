import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const GameState = {
  BETTING_OPEN: 'BETTING_OPEN',
  SHAKING: 'SHAKING',
  RESULT_REVEAL: 'RESULT_REVEAL',
};

const SicBo = () => {
  const [currentState, setCurrentState] = useState(GameState.BETTING_OPEN);
  const [dice, setDice] = useState([1, 1, 1]);
  const [betLineup, setBetLineup] = useState([]);
  const [credits, setCredits] = useState(2500);
  const [lastWin, setLastWin] = useState(0);

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";
  const neonCyan = "#00F0FF";

  const shakeDice = async () => {
    if (betLineup.length === 0) return;
    
    setCurrentState(GameState.SHAKING);
    cardSoundManager.playChipClink();

    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      
      // Determine bet type from lineup
      const betType = betLineup[0]?.type || 'SMALL';
      
      // 1. Place bet (server-authoritative)
      const betResponse = await fetch(`${API}/api/practice/casino/bet`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({
          game_type: 'sicbo',
          bet_amount: 25,
          bet_data: {bet_type: betType.toLowerCase()}
        })
      });
      const {game_id} = await betResponse.json();
      
      // 2. Execute shake (server generates 3 dice)
      const spinResponse = await fetch(`${API}/api/practice/casino/spin`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({game_id})
      });
      const {result, payout} = await spinResponse.json();
      
      // 3. Update UI with server result
      setTimeout(() => {
        setDice(result.dice);
        setCurrentState(GameState.RESULT_REVEAL);
        setLastWin(payout);
        setCredits(prev => prev + payout);
        
        setTimeout(() => {
          setCurrentState(GameState.BETTING_OPEN);
          setBetLineup([]);
        }, 3000);
      }, 2000);
      
    } catch (error) {
      // console.error('Server-authoritative shake failed:', error);
      // Fallback to client-side
      setTimeout(() => {
        const newDice = [
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ];
        setDice(newDice);
        setCurrentState(GameState.RESULT_REVEAL);
        processPayouts(newDice);
      }, 2000);
    }
  };

  const processPayouts = (resultDice) => {
    const total = resultDice.reduce((a, b) => a + b, 0);
    const isTriple = resultDice[0] === resultDice[1] && resultDice[1] === resultDice[2];
    
    let winnings = 0;
    betLineup.forEach(bet => {
      if (bet.type === 'SMALL' && total >= 4 && total <= 10 && !isTriple) {
        winnings += bet.amount * 2;
      } else if (bet.type === 'BIG' && total >= 11 && total <= 17 && !isTriple) {
        winnings += bet.amount * 2;
      } else if (bet.type === 'TRIPLE_ANY' && isTriple) {
        winnings += bet.amount * 31;
      }
    });

    setLastWin(winnings);
    setCredits(credits + winnings);
    
    setTimeout(() => {
      setCurrentState(GameState.BETTING_OPEN);
      setBetLineup([]);
    }, 3000);
  };

  return (
    <div className="min-h-screen p-8" 
         style={{ background: 'radial-gradient(circle at 50% 50%, #1A0B2E 0%, #08030F 60%, #000000 100%)' }}>
      <ParticleEffectsOverlay />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl md:text-6xl font-black text-[#D4AF37] mb-2 tracking-wider font-serif">
          SIC BO
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Ancient Chinese Dice Game</p>
      </motion.div>
      
      {/* 🏛 The Sic Bo Grid Layout */}
      <div className="grid grid-cols-12 gap-2 max-w-6xl mx-auto">
        
        {/* Top Row: Big / Small / Triples */}
        <div 
          className={`col-span-3 h-32 ${glassEffect} flex flex-col items-center justify-center rounded-tl-3xl cursor-pointer hover:border-[#00F0FF] transition-all`}
          onClick={() => setBetLineup([...betLineup, { type: 'SMALL', amount: 25 }])}
        >
          <span className="text-2xl font-black text-white">SMALL</span>
          <span className="text-xs text-gray-400">4-10 (1:1)</span>
        </div>

        <div className={`col-span-6 h-32 ${glassEffect} flex items-center justify-center gap-4`}>
          <div className="text-center px-4">
            <p className="text-[#D4AF37] font-bold text-sm">ANY TRIPLE</p>
            <p className="text-xs text-gray-400">30:1</p>
          </div>
          {/* Visual Shaker */}
          <div className="w-24 h-24 rounded-full bg-indigo-900/50 border-2 border-[#00F0FF] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {currentState === GameState.SHAKING ? (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-3xl"
                >
                  🎲
                </motion.div>
              ) : (
                <span className="text-white font-bold">{dice.join('-')}</span>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div 
          className={`col-span-3 h-32 ${glassEffect} flex flex-col items-center justify-center rounded-tr-3xl cursor-pointer hover:border-[#00F0FF] transition-all`}
          onClick={() => setBetLineup([...betLineup, { type: 'BIG', amount: 25 }])}
        >
          <span className="text-2xl font-black text-white">BIG</span>
          <span className="text-xs text-gray-400">11-17 (1:1)</span>
        </div>

        {/* Middle Rows: Number combinations would go here */}
        <div className="col-span-12 h-48 grid grid-cols-6 gap-2">
          {[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(num => (
            <div 
              key={num}
              className={`${glassEffect} flex items-center justify-center cursor-pointer hover:border-[#00F0FF] transition-all`}
            >
              <span className="text-white font-bold">{num}</span>
            </div>
          ))}
        </div>

        {/* Bottom Row: Specific combinations */}
        <div className="col-span-12 h-24 grid grid-cols-6 gap-2">
          {['Odd', 'Even', 'Small', 'Big', '4-10', '11-17'].map(bet => (
            <div 
              key={bet}
              className={`${glassEffect} flex items-center justify-center cursor-pointer hover:border-[#00F0FF] transition-all text-xs font-bold text-white uppercase`}
            >
              {bet}
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-12 flex justify-center gap-6">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        <button 
          onClick={shakeDice}
          disabled={currentState !== GameState.BETTING_OPEN || betLineup.length === 0}
          className="px-16 py-4 bg-[#00F0FF] text-black font-black uppercase italic disabled:opacity-30 disabled:bg-gray-600 transition-all hover:scale-105"
          style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
        >
          {currentState === GameState.SHAKING ? 'Shaking...' : 'Shake Dice'}
        </button>

        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Last Win</p>
          <p className="text-2xl font-black text-[#00F0FF]">${lastWin}</p>
        </div>
      </div>

      {/* Active Bets Display */}
      {betLineup.length > 0 && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`mt-8 max-w-md mx-auto ${glassEffect} rounded-2xl p-4`}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-2">Active Bets</p>
          <div className="space-y-1">
            {betLineup.map((bet, idx) => (
              <div key={`bet-${bet.type}-${idx}`} className="flex justify-between text-sm">
                <span className="text-white">{bet.type}</span>
                <span className="text-[#D4AF37] font-bold">${bet.amount}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SicBo;
