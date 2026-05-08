import React from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';

/**
 * Reusable Social Button for all games
 * Shows nearby players and opens social overlay
 */
const SocialGameButton = ({ onClick, nearbyCount = 0, position = 'top-52' }) => {
  return (
    <motion.button
      onClick={onClick}
      className={`fixed ${position} right-5 z-50 bg-pink-600/80 hover:bg-pink-500 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm border border-pink-400/50 flex items-center gap-2`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Users className="w-4 h-4" />
      <span className="text-sm font-bold">PLAYERS</span>
      {nearbyCount > 0 && (
        <span className="bg-cyan-400 text-black text-xs font-bold px-2 py-0.5 rounded-full">
          {nearbyCount}
        </span>
      )}
    </motion.button>
  );
};

export default SocialGameButton;
