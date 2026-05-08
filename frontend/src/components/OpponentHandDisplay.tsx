import React from 'react';
import { motion } from 'framer-motion';

/**
 * OpponentHandDisplay - Visual display of opponent's cards as card backs
 * Shows opponent's hand size in a realistic way
 */
export function OpponentHandDisplay({ cardCount = 7, maxDisplay = 10, size = 'small' }) {
  const displayCount = Math.min(cardCount, maxDisplay);
  
  // Size configurations
  const sizes = {
    small: { width: 50, height: 70, overlap: 35 },
    medium: { width: 70, height: 100, overlap: 50 },
    large: { width: 90, height: 130, overlap: 65 }
  };
  
  const cardSize = sizes[size] || sizes.small;
  
  return (
    <div className="flex items-center gap-3">
      {/* Card backs display */}
      <div 
        className="relative flex items-center"
        style={{ 
          height: `${cardSize.height}px`,
          width: `${cardSize.overlap * (displayCount - 1) + cardSize.width}px`
        }}
      >
        {[...Array(displayCount)].map((_, index) => (
          <motion.div
            key={`card-back-${index}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="absolute rounded-lg shadow-2xl border-2 border-white/20"
            style={{
              left: `${index * cardSize.overlap}px`,
              width: `${cardSize.width}px`,
              height: `${cardSize.height}px`,
              zIndex: index,
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1e3a8a 100%)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 0 20px rgba(59, 130, 246, 0.3)'
            }}
          >
            {/* UNO logo pattern */}
            <div className="absolute inset-0 flex items-center justify-center opacity-40">
              <div className="text-white font-black text-xs transform -rotate-45">
                UNO
              </div>
            </div>
            
            {/* Card back pattern */}
            <div 
              className="absolute inset-2 rounded border-2 border-blue-400/40"
              style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(59, 130, 246, 0.1) 10px, rgba(59, 130, 246, 0.1) 20px)'
              }}
            />
            
            {/* Center emblem */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-8 h-8 rounded-full border-2 border-blue-300/60 bg-blue-900/40"
                style={{
                  boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)'
                }}
              >
                <div className="w-full h-full flex items-center justify-center text-blue-200 text-xs font-bold">
                  🃏
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Card count badge */}
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="bg-gradient-to-br from-red-600 to-rose-700 px-3 py-2 rounded-xl border-2 border-red-400 shadow-lg"
      >
        <p className="text-red-200 text-xs font-bold">Cards</p>
        <p className="text-white text-xl font-black">{cardCount}</p>
      </motion.div>
      
      {/* Overflow indicator */}
      {cardCount > maxDisplay && (
        <div className="text-yellow-400 text-xs font-bold">
          +{cardCount - maxDisplay}
        </div>
      )}
    </div>
  );
}
