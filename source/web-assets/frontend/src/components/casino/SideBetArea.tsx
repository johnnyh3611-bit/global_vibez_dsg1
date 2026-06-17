import React from 'react';
import { motion } from 'framer-motion';

export default function SideBetArea({ sideBets, setSideBets, selectedChip, balance }) {
  const handleSideBetClick = (betType) => {
    const newAmount = (sideBets[betType] || 0) + selectedChip;
    if (newAmount <= balance) {
      setSideBets({ ...sideBets, [betType]: newAmount });
    }
  };

  const clearSideBet = (betType) => {
    setSideBets({ ...sideBets, [betType]: 0 });
  };

  return (
    <div className="flex gap-4 justify-center mb-4">
      {/* Perfect Pairs */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        onClick={() => handleSideBetClick('perfect_pairs')}
        className="relative cursor-pointer"
      >
        <div className="w-40 h-24 rounded-xl bg-gradient-to-br from-purple-600/30 to-pink-600/30 border-2 border-purple-400/50 backdrop-blur-sm flex flex-col items-center justify-center hover:border-purple-400 transition-all">
          <div className="text-xs text-purple-300 font-semibold uppercase tracking-wider">Perfect Pairs</div>
          <div className="text-sm text-purple-200 mt-1">25:1 / 12:1 / 5:1</div>
          {sideBets.perfect_pairs > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-3 -right-3 bg-purple-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold shadow-lg"
            >
              ${sideBets.perfect_pairs}
            </motion.div>
          )}
        </div>
        {sideBets.perfect_pairs > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); clearSideBet('perfect_pairs'); }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full"
          >
            Clear
          </button>
        )}
      </motion.div>

      {/* 21+3 */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        onClick={() => handleSideBetClick('21_plus_3')}
        className="relative cursor-pointer"
      >
        <div className="w-40 h-24 rounded-xl bg-gradient-to-br from-blue-600/30 to-cyan-600/30 border-2 border-blue-400/50 backdrop-blur-sm flex flex-col items-center justify-center hover:border-blue-400 transition-all">
          <div className="text-xs text-blue-300 font-semibold uppercase tracking-wider">21+3</div>
          <div className="text-sm text-blue-200 mt-1">100:1 / 40:1 / 30:1</div>
          {sideBets['21_plus_3'] > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-3 -right-3 bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold shadow-lg"
            >
              ${sideBets['21_plus_3']}
            </motion.div>
          )}
        </div>
        {sideBets['21_plus_3'] > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); clearSideBet('21_plus_3'); }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full"
          >
            Clear
          </button>
        )}
      </motion.div>
    </div>
  );
}
