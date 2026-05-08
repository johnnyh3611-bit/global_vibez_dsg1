import React from 'react';
import { motion } from 'framer-motion';
import { getRankColor } from '@/data/aiOpponents';

/**
 * AI Opponent Profile Card
 * Displays realistic human-like opponent during games
 */
export function AIOpponentCard({ opponent, compact = false }) {
  if (!opponent) return null;

  if (compact) {
    // Compact version for in-game display
    return (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-md px-4 py-3 rounded-2xl border-2 border-purple-500/30 shadow-2xl"
      >
        {/* Avatar */}
        <div className="relative">
          <img 
            src={opponent.avatar} 
            alt={opponent.name}
            className="w-12 h-12 rounded-full object-cover border-2 border-purple-400 shadow-lg"
          />
          <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full border border-white">
            {opponent.level}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <h3 className="text-white font-bold text-sm">{opponent.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-bold bg-gradient-to-r ${getRankColor(opponent.rank)} bg-clip-text text-transparent`}>
              {opponent.rank}
            </span>
            <span className="text-gray-400 text-xs">• {opponent.wins} wins</span>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full profile card
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 border-2 border-purple-500/30 shadow-2xl"
    >
      {/* Avatar */}
      <div className="relative w-32 h-32 mx-auto mb-4">
        <img 
          src={opponent.avatar} 
          alt={opponent.name}
          className="w-full h-full rounded-full object-cover border-4 border-purple-400 shadow-2xl"
        />
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-black px-3 py-1 rounded-full border-2 border-white shadow-lg">
          LVL {opponent.level}
        </div>
      </div>

      {/* Name & Rank */}
      <h2 className="text-white text-2xl font-black text-center mb-2">{opponent.name}</h2>
      <div className={`text-center text-lg font-bold bg-gradient-to-r ${getRankColor(opponent.rank)} bg-clip-text text-transparent mb-3`}>
        {opponent.rank} Tier
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <p className="text-gray-400 text-xs">Wins</p>
          <p className="text-white font-bold text-lg">{opponent.wins}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <p className="text-gray-400 text-xs">Win Rate</p>
          <p className="text-green-400 font-bold text-lg">{opponent.winRate}%</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 text-center">
          <p className="text-gray-400 text-xs">Level</p>
          <p className="text-cyan-400 font-bold text-lg">{opponent.level}</p>
        </div>
      </div>

      {/* Play Style */}
      <div className="bg-purple-900/30 rounded-lg px-3 py-2 mb-3">
        <p className="text-purple-300 text-xs font-bold">PLAY STYLE</p>
        <p className="text-white font-bold">{opponent.playStyle}</p>
      </div>

      {/* Bio */}
      <p className="text-gray-400 text-sm text-center italic">
        "{opponent.bio}"
      </p>
    </motion.div>
  );
}
