import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function NeonLightningRoulette() {
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState('PLACE YOUR BET ON RED / BLACK');
  const [multiplier, setMultiplier] = useState(50);

  const spinWheel = () => {
    if (spinning) return;
    setSpinning(true);
    setResult('WHEEL IS SPINNING...');

    setTimeout(() => {
      const num = Math.floor(Math.random() * 37);
      const isRed = num % 2 === 1;
      const mults = [50, 100, 250, 500];
      setMultiplier(mults[Math.floor(Math.random() * mults.length)]);
      setResult(`⚡ Result: ${num} (${isRed ? 'RED' : 'BLACK'})`);
      setSpinning(false);
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl rounded-3xl border border-amber-500/20 shadow-2xl max-w-lg mx-auto text-white">
      <h2 className="text-xl font-black tracking-wider uppercase bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-transparent mb-1">
        Lightning Roulette
      </h2>
      <p className="text-xs text-white/50 mb-6">Massively Multiplayer Wheel · Up to {multiplier}x</p>

      <div className="relative w-48 h-48 rounded-full border-4 border-amber-400/50 flex items-center justify-center bg-slate-900 shadow-[0_0_30px_rgba(251,191,36,0.2)] mb-6 overflow-hidden">
        <motion.div
          animate={spinning ? { rotate: [0, 1080] } : { rotate: 0 }}
          transition={{ duration: 2, ease: "easeInOut" }}
          className="absolute inset-2 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center text-3xl font-black text-amber-300"
        >
          🎰
        </motion.div>
      </div>

      <div className="text-sm font-bold text-center tracking-wider text-amber-300 uppercase mb-6 h-8 flex items-center">
        {result}
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        disabled={spinning}
        onClick={spinWheel}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 font-black uppercase tracking-wider text-sm shadow-amber-500/30 shadow-lg border border-amber-400/30 text-slate-950"
      >
        {spinning ? 'Spinning Wheel...' : 'Spin Roulette 🎡'}
      </motion.button>
    </div>
  );
}
