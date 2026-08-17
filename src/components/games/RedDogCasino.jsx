import React, { useState } from 'react';
import { motion } from 'framer-motion';

export default function RedDogCasino() {
  const [cards, setCards] = useState([3, 10]);
  const [thirdCard, setThirdCard] = useState(null);
  const [status, setStatus] = useState('PRESS DEAL TO START');

  const dealCards = () => {
    const c1 = Math.floor(Math.random() * 11) + 2;
    const c2 = Math.floor(Math.random() * 11) + 2;
    const c3 = Math.floor(Math.random() * 11) + 2;
    setCards([Math.min(c1, c2), Math.max(c1, c2)]);
    setThirdCard(c3);

    const min = Math.min(c1, c2);
    const max = Math.max(c1, c2);

    if (max - min <= 1) {
      setStatus('🔄 PUSH: Spread is too close!');
    } else if (c3 > min && c3 < max) {
      setStatus(`🎉 YOU WIN! (${c3} fell between ${min} & ${max})`);
    } else {
      setStatus(`💀 YOU LOSE! (${c3} was outside ${min} & ${max})`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl rounded-3xl border border-emerald-500/20 shadow-2xl max-w-lg mx-auto text-white">
      <h2 className="text-xl font-black tracking-wider uppercase bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent mb-1">
        Red Dog Casino
      </h2>
      <p className="text-xs text-white/50 mb-6">High-Stakes Spread Game</p>

      <div className="w-full bg-slate-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center mb-6">
        <div className="flex gap-4 mb-4">
          <div className="w-14 h-20 bg-slate-800 border border-emerald-400/40 rounded-xl flex items-center justify-center text-xl font-black text-emerald-300">
            {cards[0]}
          </div>
          <div className="w-14 h-20 bg-slate-800 border border-emerald-400/40 rounded-xl flex items-center justify-center text-xl font-black text-emerald-300">
            {cards[1]}
          </div>
        </div>

        {thirdCard !== null && (
          <div className="mb-3 text-center">
            <span className="text-[10px] font-mono uppercase text-white/50">Drawn Card</span>
            <div className="w-14 h-20 bg-emerald-950 border-2 border-emerald-400 rounded-xl flex items-center justify-center text-2xl font-black text-emerald-200 mx-auto mt-1">
              {thirdCard}
            </div>
          </div>
        )}

        <div className="text-xs font-bold text-center tracking-wider text-emerald-300 uppercase">
          {status}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        onClick={dealCards}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-600 font-black uppercase tracking-wider text-sm shadow-emerald-500/30 shadow-lg border border-emerald-400/30"
      >
        Deal Spread 🃏
      </motion.button>
    </div>
  );
}
