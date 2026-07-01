import React from 'react';
import { motion } from 'framer-motion';

const PropBetsBoard = ({ onPlaceBet, disabled = false }) => {
  const bets = [
    { name: "Snake Eyes", odds: "30:1", roll: [1, 1], style: "from-blue-900 to-blue-950", emoji: "🐍" },
    { name: "Boxcars", odds: "30:1", roll: [6, 6], style: "from-amber-700 to-amber-900", emoji: "🚂" },
    { name: "Yo-leven", odds: "15:1", roll: [5, 6], style: "from-emerald-700 to-emerald-900", emoji: "🎯" },
    { name: "Hard 8", odds: "9:1", roll: [4, 4], style: "from-red-800 to-red-950", emoji: "💎" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-4 p-3 sm:p-4 bg-black/40 backdrop-blur-md rounded-xl border border-white/20">
      <div className="col-span-2 text-center mb-2">
        <p className="text-amber-300 text-xs sm:text-sm font-bold uppercase tracking-wider">Proposition Bets</p>
      </div>
      {bets.map((bet) => (
        <motion.button
          key={bet.name}
          onClick={() => !disabled && onPlaceBet(bet)}
          disabled={disabled}
          whileHover={{ scale: disabled ? 1 : 1.05 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
          className={`bg-gradient-to-br ${bet.style} p-3 sm:p-6 rounded-lg border-2 border-white/30 transition-all group disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <div className="text-lg sm:text-2xl mb-1">{bet.emoji}</div>
          <div className="text-xs sm:text-sm uppercase opacity-70 group-hover:opacity-100 transition-opacity">{bet.odds}</div>
          <div className="text-sm sm:text-xl font-black tracking-tight">{bet.name}</div>
        </motion.button>
      ))}
    </div>
  );
};

export default PropBetsBoard;
