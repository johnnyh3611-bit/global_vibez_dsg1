import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Vibe654PopBubble() {
  const [isPopping, setIsPopping] = useState(false);
  const [dice, setDice] = useState([4, 5, 6]);
  const [outcome, setOutcome] = useState('PRESS POP TO ROLL');
  const [scoreColor, setScoreColor] = useState('text-cyan-400');

  const evaluateRoll = (d) => {
    const sorted = [...d].sort((a, b) => a - b);
    
    if (sorted[0] === 4 && sorted[1] === 5 && sorted[2] === 6) {
      setScoreColor('text-emerald-400 animate-pulse');
      return '🎉 4-5-6 AUTOMATIC WIN!';
    }
    if (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3) {
      setScoreColor('text-rose-500');
      return '💀 1-2-3 AUTOMATIC LOSS';
    }
    if (sorted[0] === sorted[1] && sorted[1] === sorted[2]) {
      setScoreColor('text-amber-400');
      return `🔥 TRIPS! Triple ${sorted[0]}s!`;
    }
    if (sorted[0] === sorted[1]) {
      setScoreColor('text-cyan-300');
      return `⚡ Point: ${sorted[2]}`;
    }
    if (sorted[1] === sorted[2]) {
      setScoreColor('text-cyan-300');
      return `⚡ Point: ${sorted[0]}`;
    }
    setScoreColor('text-white/60');
    return '🔄 No Point — Roll Again';
  };

  const handlePopRoll = () => {
    if (isPopping) return;
    setIsPopping(true);
    setOutcome('BUBBLE BOUNCING...');
    setScoreColor('text-white/80');

    setTimeout(() => {
      const newDice = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      setDice(newDice);
      setOutcome(evaluateRoll(newDice));
      setIsPopping(false);
    }, 3000);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl max-w-md mx-auto text-white">
      <h2 className="text-xl font-black tracking-wider uppercase mb-1 bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
        Vibe 654: Pop Edition
      </h2>
      <p className="text-xs text-white/50 mb-6">Bubble Kinetic Dice Lounge</p>

      <div className="relative w-64 h-64 rounded-full bg-gradient-to-br from-white/10 via-white/5 to-transparent border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[inset_0_0_40px_rgba(255,255,255,0.1)] overflow-hidden mb-6">
        
        <div className="absolute top-4 left-8 w-16 h-8 bg-white/20 rounded-full blur-md rotate-[-30deg]" />

        <AnimatePresence mode="wait">
          {isPopping ? (
            <div className="absolute inset-0 flex items-center justify-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-12 h-12 bg-white/90 rounded-xl shadow-lg flex items-center justify-center text-slate-950 font-black text-xl border border-white"
                  animate={{
                    x: [Math.random() * 80 - 40, Math.random() * -80 + 40, Math.random() * 60 - 30],
                    y: [Math.random() * 80 - 40, Math.random() * -80 + 40, Math.random() * 60 - 30],
                    rotate: [0, 180, 360],
                    scale: [1, 1.1, 0.9, 1]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 0.4,
                    ease: "easeInOut"
                  }}
                >
                  🎲
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex gap-4 items-center"
            >
              {dice.map((val, idx) => (
                <motion.div
                  key={idx}
                  whileHover={{ scale: 1.1 }}
                  className="w-14 h-14 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-cyan-400/50 rounded-2xl flex items-center justify-center text-2xl font-black shadow-[0_0_20px_rgba(6,182,212,0.3)] text-cyan-300"
                >
                  {val}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={`text-sm font-bold tracking-widest uppercase mb-6 h-8 flex items-center justify-center ${scoreColor}`}>
        {outcome}
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        disabled={isPopping}
        onClick={handlePopRoll}
        className={`w-full py-4 rounded-2xl font-black uppercase tracking-wider text-sm transition-all shadow-lg ${
          isPopping
            ? 'bg-slate-800 text-white/30 cursor-not-allowed border border-white/5'
            : 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-cyan-500/25 border border-cyan-400/30 hover:shadow-cyan-500/40'
        }`}
      >
        {isPopping ? 'Pop Rolling...' : 'Pop & Roll 🎲'}
      </motion.button>
    </div>
  );
}
