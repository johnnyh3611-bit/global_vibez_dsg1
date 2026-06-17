import React, { useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';

const BigSixWheel = () => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [betLineup, setBetLineup] = useState([]);
  const [credits, setCredits] = useState(5000);
  const [result, setResult] = useState(null);
  const controls = useAnimation();

  const glassEffect = "bg-black/40 backdrop-blur-xl border border-white/10";
  const neonCyan = "#00F0FF";
  const gold = "#D4AF37";

  // 54 total segments on standard Big Six Wheel
  const WHEEL_SEGMENTS = [
    { symbol: '$1', count: 24, payout: 1 },
    { symbol: '$2', count: 15, payout: 2 },
    { symbol: '$5', count: 7, payout: 5 },
    { symbol: '$10', count: 4, payout: 10 },
    { symbol: '$20', count: 2, payout: 20 },
    { symbol: 'JOKER', count: 1, payout: 40 },
    { symbol: 'LOGO', count: 1, payout: 40 }
  ];

  const spinWheel = async () => {
    if (isSpinning || betLineup.length === 0) return;
    
    setIsSpinning(true);
    cardSoundManager.playChipClink();

    const extraSpins = 5 + Math.random() * 5;
    const finalAngle = rotation + (extraSpins * 360) + (Math.random() * 360);
    
    await controls.start({
      rotate: finalAngle,
      transition: { duration: 6, ease: "easeOut" }
    });

    setRotation(finalAngle % 360);
    
    // Determine result based on final angle
    const winningSymbol = WHEEL_SEGMENTS[Math.floor(Math.random() * WHEEL_SEGMENTS.length)].symbol;
    setResult(winningSymbol);
    
    // Calculate winnings
    let totalWin = 0;
    betLineup.forEach(bet => {
      if (bet.type === winningSymbol) {
        const segment = WHEEL_SEGMENTS.find(s => s.symbol === winningSymbol);
        totalWin += bet.amount * (segment.payout + 1);
      }
    });
    
    setCredits(credits + totalWin);
    setIsSpinning(false);
    cardSoundManager.playWinSound();
    
    setTimeout(() => {
      setBetLineup([]);
      setResult(null);
    }, 3000);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
         style={{ background: 'radial-gradient(circle at 50% 50%, #1A0B2E 0%, #08030F 60%, #000000 100%)' }}>
      <ParticleEffectsOverlay />
      
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl md:text-6xl font-black text-[#D4AF37] mb-2 tracking-wider font-serif">
          BIG SIX WHEEL
        </h1>
        <p className="text-white/60 text-sm uppercase tracking-[0.2em]">Wheel of Fortune</p>
      </motion.div>
      
      {/* 🎡 THE WHEEL DISPLAY */}
      <div className="relative flex flex-col items-center">
        {/* The "Clapper" / Indicator */}
        <div 
          className="absolute top-[-20px] z-20 w-8 h-12 bg-[#00F0FF] shadow-[0_0_15px_#00F0FF]" 
          style={{ clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }} 
        />
        
        <motion.div 
          animate={controls}
          className="w-[500px] h-[500px] rounded-full border-8 border-white/10 shadow-[0_0_50px_rgba(0,240,255,0.2)] bg-slate-900 relative overflow-hidden"
          style={{ background: 'conic-gradient(from 0deg, #1F2937, #111827, #1F2937)' }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-white/10 font-black text-6xl italic">
            GLOBAL VIBEZ
          </div>
          
          {result && !isSpinning && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="text-8xl font-black text-white bg-black/60 px-12 py-6 rounded-2xl border-4 border-[#00F0FF]">
                {result}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* 📊 BETTING GRID */}
      <div className="mt-12 grid grid-cols-6 gap-2 w-full max-w-4xl">
        {WHEEL_SEGMENTS.map((bet, i) => (
          <button 
            key={`wheel-segment-${bet.symbol}-${i}`}
            className={`h-24 ${glassEffect} hover:border-[#00F0FF] transition-all text-white font-black uppercase text-xs disabled:opacity-30`}
            onClick={() => setBetLineup([...betLineup, { type: bet.symbol, amount: 25 }])}
            disabled={isSpinning}
          >
            <div className="text-center">
              <p className="text-2xl mb-1">{bet.symbol}</p>
              <p className="text-[#D4AF37] text-xs">{bet.payout}:1</p>
            </div>
          </button>
        ))}
      </div>

      <button 
        onClick={spinWheel}
        disabled={isSpinning || betLineup.length === 0}
        className="mt-10 px-20 py-5 bg-[#00F0FF] text-black font-black uppercase italic disabled:opacity-30 disabled:bg-gray-600 transition-all hover:scale-105"
        style={{ clipPath: 'polygon(5% 0, 100% 0, 95% 100%, 0 100%)' }}
      >
        {isSpinning ? 'Spinning...' : 'Spin the Wheel'}
      </button>

      {/* HUD */}
      <div className="absolute top-8 right-8 text-right">
        <p className="text-gray-400 text-xs uppercase tracking-widest">Credits</p>
        <p className="text-2xl font-black text-[#D4AF37]">${credits}</p>
      </div>
    </div>
  );
};

export default BigSixWheel;
