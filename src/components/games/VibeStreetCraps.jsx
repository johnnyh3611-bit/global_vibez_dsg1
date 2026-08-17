import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VibeStreetCraps() {
  const [point, setPoint] = useState(null);
  const [dice, setDice] = useState([3, 4]);
  const [rolling, setRolling] = useState(false);
  const [message, setMessage] = useState('PLACE YOUR BETS · COME OUT ROLL');

  const rollDice = () => {
    if (rolling) return;
    setRolling(true);
    setMessage('SHOOTER IS ROLLING...');

    setTimeout(() => {
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      setDice([d1, d2]);
      setRolling(false);

      if (point === null) {
        if (total === 7 || total === 11) {
          setMessage(`🔥 NATURAL ${total}! PASS LINE WINS!`);
        } else if (total === 2 || total === 3 || total === 12) {
          setMessage(`💀 CRAPS ${total}! BUST!`);
        } else {
          setPoint(total);
          setMessage(`⚡ POINT IS NOW ${total}! ROLL AGAIN!`);
        }
      } else {
        if (total === point) {
          setMessage(`🎉 HIT THE POINT ${total}! YOU WIN!`);
          setPoint(null);
        } else if (total === 7) {
          setMessage('💥 SEVEN OUT! TABLE CLEARS.');
          setPoint(null);
        } else {
          setMessage(`🎲 Rolled ${total}. Keep rolling for point ${point}!`);
        }
      }
    }, 1500);
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl rounded-3xl border border-cyan-500/20 shadow-2xl max-w-lg mx-auto text-white">
      <h2 className="text-xl font-black tracking-wider uppercase bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent mb-1">
        Vibe Street Craps
      </h2>
      <p className="text-xs text-white/50 mb-6">Multiplayer Shooter Arena</p>

      <div className="w-full bg-slate-900/80 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center mb-6 shadow-inner">
        <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 mb-2">
          {point ? `Active Point: ${point}` : 'Phase: Come Out Roll'}
        </div>
        <div className="flex gap-6 my-4">
          {dice.map((d, i) => (
            <motion.div
              key={i}
              animate={rolling ? { rotate: [0, 360, 720], scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.5 }}
              className="w-16 h-16 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-cyan-400/50 rounded-2xl flex items-center justify-center text-3xl font-black text-cyan-300 shadow-lg"
            >
              {d}
            </motion.div>
          ))}
        </div>
        <div className="text-sm font-bold text-center tracking-wide text-white/90 mt-2">
          {message}
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.05 }}
        disabled={rolling}
        onClick={rollDice}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-black uppercase tracking-wider text-sm shadow-cyan-500/30 shadow-lg border border-cyan-400/30"
      >
        {rolling ? 'Rolling Dice...' : 'Shoot Dice 🎲'}
      </motion.button>
    </div>
  );
}
