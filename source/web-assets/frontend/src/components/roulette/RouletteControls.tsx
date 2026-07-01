/**
 * RouletteControls - Game control panel
 * Spin, clear bets, chip selector, credits display
 */
import React from 'react';
import { motion } from 'framer-motion';

const RouletteControls = ({
  credits,
  chipValue,
  setChipValue,
  totalBet,
  onSpin,
  onClear,
  onRepeatBet,
  isSpinning,
  hasCurrentBets,
  hasLastRoundBets
}) => {
  const chipValues = [10, 25, 50, 100, 500, 1000];

  return (
    <div className="space-y-4">
      {/* Credits Display */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 rounded-2xl p-4 border-2 border-emerald-500/30 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-300 text-sm font-bold mb-1">Your Credits</p>
            <p className="text-white text-3xl font-black">₵{credits.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-amber-300 text-sm font-bold mb-1 text-right">Total Bet</p>
            <p className="text-amber-400 text-3xl font-black text-right">₵{totalBet}</p>
          </div>
        </div>
      </div>

      {/* Chip Selector */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
        <p className="text-amber-300 text-sm font-bold mb-3">Select Chip Value:</p>
        <div className="grid grid-cols-3 gap-2">
          {chipValues.map((val) => (
            <motion.button
              key={val}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setChipValue(val)}
              disabled={isSpinning}
              className={`py-3 rounded-xl font-black text-sm transition-all shadow-lg ${
                chipValue === val
                  ? 'bg-gradient-to-br from-amber-500 to-yellow-600 text-white scale-110 border-2 border-white/50'
                  : 'bg-gradient-to-br from-gray-700 to-gray-800 text-gray-300 hover:from-gray-600 hover:to-gray-700 border border-white/10'
              } disabled:opacity-30`}
            >
              ${val}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClear}
          disabled={isSpinning || !hasCurrentBets}
          className="bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white font-black py-4 rounded-xl shadow-xl disabled:opacity-30 text-sm"
        >
          🗑️ CLEAR
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onRepeatBet}
          disabled={isSpinning || !hasLastRoundBets}
          className="bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-black py-4 rounded-xl shadow-xl disabled:opacity-30 text-sm"
        >
          🔄 REBET
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSpin}
          disabled={isSpinning || !hasCurrentBets}
          className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black py-4 rounded-xl shadow-xl disabled:opacity-30 text-sm"
        >
          {isSpinning ? '🎰 SPINNING...' : '🎰 SPIN'}
        </motion.button>
      </div>

      {/* Quick Bet Buttons */}
      <div className="bg-black/40 backdrop-blur-xl rounded-2xl p-4 border border-white/10">
        <p className="text-amber-300 text-xs font-bold mb-2">Quick Bets:</p>
        <div className="flex gap-2 text-xs">
          <button 
            disabled={isSpinning}
            className="flex-1 bg-red-700/30 hover:bg-red-700/50 border border-red-500/30 text-red-400 py-2 rounded-lg transition-all disabled:opacity-30 font-bold"
          >
            ALL RED
          </button>
          <button 
            disabled={isSpinning}
            className="flex-1 bg-gray-800/50 hover:bg-gray-800/70 border border-gray-600/30 text-gray-300 py-2 rounded-lg transition-all disabled:opacity-30 font-bold"
          >
            ALL BLACK
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouletteControls;
