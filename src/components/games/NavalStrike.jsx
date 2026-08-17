import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function NavalStrike() {
  const [shots, setShots] = useState({});
  const [message, setMessage] = useState('LAUNCH MISSILE STRIKE ON ENEMY GRID');

  const handleShoot = (idx) => {
    if (shots[idx]) return;
    const isHit = Math.random() < 0.3; // 30% hit rate
    setShots({ ...shots, [idx]: isHit ? 'hit' : 'miss' });
    setMessage(isHit ? '💥 DIRECT HIT! ENEMY VESSEL DAMAGED!' : '🌊 MISS! TARGET WATER CLEAR.');
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl rounded-3xl border border-indigo-500/20 shadow-2xl max-w-lg mx-auto text-white">
      <h2 className="text-xl font-black tracking-wider uppercase bg-gradient-to-r from-indigo-400 to-pink-500 bg-clip-text text-transparent mb-1">
        Naval Strike
      </h2>
      <p className="text-xs text-white/50 mb-6">Tactical Neon Grid Duel</p>

      <div className="grid grid-cols-5 gap-2 bg-slate-900/90 p-3 rounded-2xl border border-indigo-500/30 mb-6">
        {Array(25).fill(0).map((_, i) => (
          <motion.button
            key={i}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleShoot(i)}
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black border transition-all ${
              shots[i] === 'hit'
                ? 'bg-rose-500 border-rose-300 text-white shadow-[0_0_15px_rgba(244,63,94,0.6)]'
                : shots[i] === 'miss'
                ? 'bg-slate-800 border-white/10 text-white/30'
                : 'bg-slate-900 border-white/20 hover:border-indigo-400 text-indigo-300'
            }`}
          >
            {shots[i] === 'hit' ? '💥' : shots[i] === 'miss' ? '•' : i + 1}
          </motion.button>
        ))}
      </div>

      <div className="text-xs font-black uppercase tracking-wider text-indigo-300 mb-6 h-6 flex items-center">
        {message}
      </div>

      <button onClick={() => setShots({})} className="w-full py-3 bg-gradient-to-r from-indigo-600 to-pink-600 font-black rounded-xl text-sm uppercase tracking-wider shadow-lg">
        Reset Radar
      </button>
    </div>
  );
}
