import React, { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const EuropeanRoulette = () => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [betLineup, setBetLineup] = useState([]);
  const [credits, setCredits] = useState(5000);
  const [lastWin, setLastWin] = useState(0);
  const controls = useAnimation();

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";

  // European Wheel Layout (Single 0)
  const wheelNumbers = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];

  const getNumberColor = (num) => {
    if (num === 0) return 'green';
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return redNumbers.includes(num) ? 'red' : 'black';
  };

  const spinWheel = async () => {
    if (isSpinning || betLineup.length === 0) return;
    
    setIsSpinning(true);
    cardSoundManager.playChipClink();

    try {
      const API = process.env.REACT_APP_BACKEND_URL;
      
      // Determine bet type from first bet
      const firstBet = betLineup[0];
      
      // 1. Place bet (server-authoritative)
      const betResponse = await fetch(`${API}/api/practice/casino/bet`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({
          game_type: 'roulette',
          bet_amount: 100,
          bet_data: {
            bet_type: firstBet.type,
            number: firstBet.type === 'straight' ? firstBet.number : null,
            color: firstBet.type === 'color' ? firstBet.color : null
          }
        })
      });
      const {game_id} = await betResponse.json();
      
      // 2. Execute spin (server generates result)
      const spinResponse = await fetch(`${API}/api/practice/casino/spin`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        
        body: JSON.stringify({game_id})
      });
      const {result, payout} = await spinResponse.json();
      
      // 3. Find winning index in wheel
      const winningNumber = result.number;
      const winningIndex = wheelNumbers.indexOf(winningNumber);
      const rotationPerNumber = 360 / wheelNumbers.length;
      const finalRotation = (360 * 8) - (winningIndex * rotationPerNumber);

      await controls.start({
        rotate: finalRotation,
        transition: { duration: 5, ease: [0.1, 0, 0.2, 1] }
      });

      setLastResult(winningNumber);
      setLastWin(payout);
      setCredits(credits + payout);
      setIsSpinning(false);
      if (payout > 0) cardSoundManager.playWinSound();

      setTimeout(() => {
        setBetLineup([]);
      }, 3000);
      
    } catch (error) {
      // console.error('Server-authoritative spin failed:', error);
      // Fallback to client-side
      const winningIndex = Math.floor(Math.random() * wheelNumbers.length);
      const winningNumber = wheelNumbers[winningIndex];
      const rotationPerNumber = 360 / wheelNumbers.length;
      const finalRotation = (360 * 8) - (winningIndex * rotationPerNumber);

      await controls.start({
        rotate: finalRotation,
        transition: { duration: 5, ease: [0.1, 0, 0.2, 1] }
      });

      setLastResult(winningNumber);
      processPayouts(winningNumber);
      setIsSpinning(false);
      cardSoundManager.playWinSound();

      setTimeout(() => {
        setBetLineup([]);
      }, 3000);
    }
  };

  const processPayouts = (result) => {
    let totalWin = 0;

    betLineup.forEach(bet => {
      if (bet.type === 'number' && bet.value === result) {
        totalWin += bet.amount * 36; // Straight up: 35:1 + original bet
      } else if (bet.type === 'red' && getNumberColor(result) === 'red' && result !== 0) {
        totalWin += bet.amount * 2;
      } else if (bet.type === 'black' && getNumberColor(result) === 'black' && result !== 0) {
        totalWin += bet.amount * 2;
      } else if (bet.type === 'odd' && result % 2 === 1 && result !== 0) {
        totalWin += bet.amount * 2;
      } else if (bet.type === 'even' && result % 2 === 0 && result !== 0) {
        totalWin += bet.amount * 2;
      } else if (bet.type === 'low' && result >= 1 && result <= 18) {
        totalWin += bet.amount * 2;
      } else if (bet.type === 'high' && result >= 19 && result <= 36) {
        totalWin += bet.amount * 2;
      }
    });

    setLastWin(totalWin);
    setCredits(credits + totalWin);
  };

  const placeBet = (type, value = null) => {
    if (isSpinning || credits < 25) return;
    
    cardSoundManager.playChipClink();
    setBetLineup([...betLineup, { type, value, amount: 25, id: Date.now() }]);
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
          EUROPEAN ROULETTE
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Single Zero - 2.70% House Edge</p>
      </motion.div>

      {/* 🎡 THE WHEEL */}
      <div className="relative w-80 h-80 rounded-full border-4 border-white/10 shadow-[0_0_40px_rgba(0,240,255,0.3)] bg-slate-900 overflow-hidden mb-8">
        <motion.div 
          animate={controls} 
          className="w-full h-full relative" 
          style={{ 
            backgroundImage: 'conic-gradient(from 0deg, #047857 0% 2.7%, #1F2937 2.7% 5.4%, #DC2626 5.4% 8.1%, #1F2937 8.1%)' 
          }}
        >
          {/* Visual number indicators */}
          {wheelNumbers.map((num, idx) => {
            const angle = (idx * 360) / wheelNumbers.length;
            const color = getNumberColor(num);
            return (
              <div
                key={`wheel-num-${num}`}
                className="absolute w-6 h-6 flex items-center justify-center text-white text-xs font-bold"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${angle}deg) translateY(-130px)`,
                  backgroundColor: color === 'green' ? '#047857' : color === 'red' ? '#DC2626' : '#1F2937'
                }}
              >
                {num}
              </div>
            );
          })}
        </motion.div>
        
        {/* Center Hub */}
        <div className="absolute inset-0 m-auto w-12 h-12 bg-black rounded-full border-2 border-[#00F0FF] z-10 flex items-center justify-center">
          {lastResult !== null && !isSpinning && (
            <motion.span 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-white font-black text-lg"
            >
              {lastResult}
            </motion.span>
          )}
        </div>
      </div>

      {/* Betting Grid */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button 
            onClick={() => placeBet('red')}
            disabled={isSpinning}
            className={`${glassEffect} h-20 hover:border-[#DC2626] transition-all disabled:opacity-30`}
            style={{ background: 'linear-gradient(135deg, #DC262620, transparent)' }}
          >
            <span className="text-[#DC2626] font-black uppercase">Red</span>
            <p className="text-xs text-white/60">1:1</p>
          </button>

          <button 
            onClick={() => placeBet('black')}
            disabled={isSpinning}
            className={`${glassEffect} h-20 hover:border-[#1F2937] transition-all disabled:opacity-30`}
            style={{ background: 'linear-gradient(135deg, #1F293720, transparent)' }}
          >
            <span className="text-white font-black uppercase">Black</span>
            <p className="text-xs text-white/60">1:1</p>
          </button>

          <button 
            onClick={() => placeBet('odd')}
            disabled={isSpinning}
            className={`${glassEffect} h-20 hover:border-[#00F0FF] transition-all disabled:opacity-30`}
          >
            <span className="text-white font-black uppercase">Odd</span>
            <p className="text-xs text-white/60">1:1</p>
          </button>

          <button 
            onClick={() => placeBet('even')}
            disabled={isSpinning}
            className={`${glassEffect} h-20 hover:border-[#00F0FF] transition-all disabled:opacity-30`}
          >
            <span className="text-white font-black uppercase">Even</span>
            <p className="text-xs text-white/60">1:1</p>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => placeBet('low')}
            disabled={isSpinning}
            className={`${glassEffect} h-16 hover:border-[#D4AF37] transition-all disabled:opacity-30`}
          >
            <span className="text-[#D4AF37] font-black uppercase">1-18</span>
            <p className="text-xs text-white/60">1:1</p>
          </button>

          <button 
            onClick={() => placeBet('high')}
            disabled={isSpinning}
            className={`${glassEffect} h-16 hover:border-[#D4AF37] transition-all disabled:opacity-30`}
          >
            <span className="text-[#D4AF37] font-black uppercase">19-36</span>
            <p className="text-xs text-white/60">1:1</p>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-10">
        <div className="text-center">
          <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
          <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
        </div>

        <button 
          onClick={spinWheel} 
          disabled={isSpinning || betLineup.length === 0}
          className="px-16 py-4 bg-[#00F0FF] text-black font-black uppercase italic disabled:opacity-30 disabled:bg-gray-600 transition-all hover:scale-105" 
          style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0 100%)' }}
        >
          {isSpinning ? 'Ball in Motion...' : 'Spin European Wheel'}
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
                <span className="text-white capitalize">{bet.type} {bet.value !== null ? `(${bet.value})` : ''}</span>
                <span className="text-[#D4AF37] font-bold">${bet.amount}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default EuropeanRoulette;
