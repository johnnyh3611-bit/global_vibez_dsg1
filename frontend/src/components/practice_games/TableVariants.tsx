import React from 'react';
import { motion } from 'framer-motion';

// Simple Clean Base Table (FREE - Default)
export const SimpleCleanTable = ({ playedCards, tricks, children }) => {
  return (
    <div 
      className="relative w-full"
      style={{
        height: '280px',
        transform: 'perspective(1200px) rotateX(15deg)',
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Clean Simple Table */}
      <div 
        className="absolute inset-0 rounded-[45%]"
        style={{
          background: 'linear-gradient(135deg, #7c2d12 0%, #92400e 50%, #7c2d12 100%)',
          padding: '18px',
          boxShadow: `
            inset 0 6px 16px rgba(0,0,0,0.5),
            0 20px 60px rgba(0,0,0,0.8),
            0 0 0 4px #d4af37
          `,
          border: '4px solid #8B4513'
        }}
      >
        {/* Simple Green Felt */}
        <div 
          className="w-full h-full rounded-[45%] relative"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, #16a34a 0%, #15803d 60%, #14532d 100%)',
            boxShadow: 'inset 0 8px 20px rgba(0,0,0,0.35)',
            border: '2px solid #15803d'
          }}
        >
          {/* Card positions */}
          {children}
          
          {/* Simple center indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-sm px-4 py-1 rounded-full border-2 border-white/30">
            <span className="text-white text-xs font-bold">Trick {tricks}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// B+D Mix Table - Glowing Cards + 3D Perspective (PREMIUM)
export const GlowingPerspectiveTable = ({ playedCards, tricks, children }) => {
  return (
    <div 
      className="relative w-full"
      style={{
        height: '320px',
        transform: 'perspective(1800px) rotateX(25deg)', // Stronger 3D
        transformStyle: 'preserve-3d'
      }}
    >
      {/* Premium Table with better materials */}
      <div 
        className="absolute inset-0 rounded-[45%]"
        style={{
          background: 'linear-gradient(135deg, #654321 0%, #8B4513 25%, #654321 50%, #4a2f1a 75%, #654321 100%)',
          padding: '24px',
          boxShadow: `
            inset 0 8px 20px rgba(0,0,0,0.6),
            0 30px 80px rgba(0,0,0,0.9),
            0 0 0 8px #d4af37,
            0 0 30px 8px rgba(212,175,55,0.4)
          `,
          border: '6px solid #8B4513'
        }}
      >
        {/* Vibrant Green Felt with glow */}
        <div 
          className="w-full h-full rounded-[45%] relative"
          style={{
            background: 'radial-gradient(ellipse at 45% 45%, #22c55e 0%, #16a34a 50%, #15803d 100%)',
            boxShadow: `
              inset 0 12px 30px rgba(0,0,0,0.4),
              0 0 40px rgba(34,197,94,0.3)
            `,
            border: '3px solid #15803d'
          }}
        >
          {/* Card positions with glow effect wrapper */}
          <div className="absolute inset-0 flex items-center justify-center">
            {children}
          </div>
          
          {/* Glowing center indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              animate={{ boxShadow: [
                '0 0 20px rgba(234,179,8,0.6)',
                '0 0 40px rgba(234,179,8,0.8)',
                '0 0 20px rgba(234,179,8,0.6)'
              ]}}
              transition={{ duration: 2, repeat: Infinity }}
              className="bg-black/80 backdrop-blur-sm px-5 py-2 rounded-full border-3 border-yellow-500"
            >
              <span className="text-yellow-400 text-sm font-black">Trick {tricks}</span>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Table Card with Glow Effect (for B+D table)
export const GlowingTableCard = ({ card, position = 'center', playerColor = 'yellow' }) => {
  if (!card) return null;
  
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  
  const suitSymbols = { H: '♥', D: '♦', C: '♣', S: '♠' };
  const suitColors = { H: '#dc2626', D: '#dc2626', C: '#1f2937', S: '#1f2937' };
  
  const displayRank = rank === '10' ? '10' : rank;
  const suitSymbol = suitSymbols[suit];
  const suitColor = suitColors[suit];
  
  // Glow colors for each player
  const glowColors = {
    blue: 'rgba(59, 130, 246, 0.8)',
    red: 'rgba(239, 68, 68, 0.8)',
    green: 'rgba(34, 197, 94, 0.8)',
    yellow: 'rgba(234, 179, 8, 0.9)' // Player's card - brightest
  };
  
  const positionStyles = {
    top: { top: '10px', left: '50%', marginLeft: '-40px' },
    left: { left: '10px', top: '50%', marginTop: '-56px' },
    right: { right: '10px', top: '50%', marginTop: '-56px' },
    bottom: { bottom: '10px', left: '50%', marginLeft: '-40px' }
  };
  
  // Scale for 3D effect - bottom (player) card appears larger
  const scale = position === 'bottom' ? 1.2 : 1;
  
  return (
    <motion.div
      initial={{ scale: 0, rotateY: 180 }}
      animate={{ 
        scale: scale, 
        rotateY: 0,
        boxShadow: [
          `0 0 20px ${glowColors[playerColor]}, 0 0 40px ${glowColors[playerColor]}`,
          `0 0 30px ${glowColors[playerColor]}, 0 0 60px ${glowColors[playerColor]}`,
          `0 0 20px ${glowColors[playerColor]}, 0 0 40px ${glowColors[playerColor]}`
        ]
      }}
      transition={{ 
        scale: { type: 'spring', duration: 0.6 },
        rotateY: { type: 'spring', duration: 0.6 },
        boxShadow: { duration: 2, repeat: Infinity }
      }}
      className="absolute"
      style={{
        width: '80px',
        height: '112px',
        ...positionStyles[position],
        filter: `drop-shadow(0 0 12px ${glowColors[playerColor]})`
      }}
    >
      <div 
        className="w-full h-full rounded-xl relative"
        style={{
          background: 'linear-gradient(135deg, #fefce8 0%, #fef9e7 100%)',
          border: `3px solid ${playerColor === 'yellow' ? '#eab308' : '#d4d4d4'}`,
          boxShadow: '0 12px 35px rgba(0,0,0,0.6)'
        }}
      >
        {/* Card content */}
        <div className="absolute top-2 left-2 flex flex-col items-center leading-none" style={{ color: suitColor }}>
          <span className="text-2xl font-black">{displayRank}</span>
          <span className="text-lg">{suitSymbol}</span>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center opacity-15 pointer-events-none">
          <span className="text-7xl" style={{ color: suitColor }}>{suitSymbol}</span>
        </div>
        
        <div className="absolute bottom-2 right-2 flex flex-col items-center leading-none rotate-180" style={{ color: suitColor }}>
          <span className="text-2xl font-black">{displayRank}</span>
          <span className="text-lg">{suitSymbol}</span>
        </div>
        
        {/* Extra glow on player's card */}
        {position === 'bottom' && (
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `radial-gradient(circle, ${glowColors[playerColor]} 0%, transparent 70%)`,
              mixBlendMode: 'screen'
            }}
          />
        )}
      </div>
    </motion.div>
  );
};

// Export table types for selector
export const TABLE_TYPES = {
  SIMPLE_CLEAN: 'simple_clean',
  GLOWING_PERSPECTIVE: 'glowing_perspective',
  LARGE_PLAYER_ZONE: 'large_player_zone',
  MARKED_ZONES: 'marked_zones',
  EXTREME_3D: 'extreme_3d'
};

export const TABLE_INFO = {
  [TABLE_TYPES.SIMPLE_CLEAN]: {
    name: 'Classic Table',
    description: 'Simple, clean design',
    cost: 0,
    unlockLevel: 1,
    preview: 'simple_clean_preview.png'
  },
  [TABLE_TYPES.GLOWING_PERSPECTIVE]: {
    name: 'Neon Perspective',
    description: 'Glowing cards + 3D depth',
    cost: 5000,
    unlockLevel: 5,
    preview: 'glowing_perspective_preview.png'
  }
};
