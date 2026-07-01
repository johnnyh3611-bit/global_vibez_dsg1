import React from 'react';
import { motion } from 'framer-motion';

export function ViewToggle({ view, onToggle }: { view?: any, onToggle?: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-20 right-4 z-30"
    >
      <div className="bg-black/80 backdrop-blur-xl rounded-xl border-2 border-purple-500/50 p-1 flex gap-1">
        <button
          onClick={() => onToggle('3d')}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            view === '3d'
              ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white'
              : 'text-purple-300 hover:text-white'
          }`}
        >
          <span className="mr-2">🎲</span>
          3D View
        </button>
        <button
          onClick={() => onToggle('2d')}
          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
            view === '2d'
              ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white'
              : 'text-purple-300 hover:text-white'
          }`}
        >
          <span className="mr-2">📋</span>
          2D Top-Down
        </button>
      </div>
    </motion.div>
  );
}
