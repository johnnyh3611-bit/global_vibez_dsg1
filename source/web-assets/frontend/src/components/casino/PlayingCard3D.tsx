
import React from 'react';
import { motion } from 'framer-motion';
import { CASINO_THEME } from '@/utils/casinoTheme';

// Standard poker card: 2.5" × 3.5" (5:7 ratio)
// Realistic flip animation with 0.8s timing

const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const SUIT_COLORS = {
  hearts: '#DC2626',
  diamonds: '#DC2626',
  clubs: '#000000',
  spades: '#000000'
};

export default function PlayingCard3D({
  value,
  suit,
  faceUp = true,
  animate = true,
  onClick = undefined,
  className = '',
  style = {},
  glow = false,
  size = 'normal' // 'small', 'normal', 'large'
}) {
  const sizeMultiplier = size === 'small' ? 0.7 : size === 'large' ? 1.3 : 1;
  const cardWidth = CASINO_THEME.card.width * sizeMultiplier;
  const cardHeight = CASINO_THEME.card.height * sizeMultiplier;

  return (
    <motion.div
      onClick={onClick}
      initial={animate ? { scale: 0, rotateY: 180 } : false}
      animate={{ 
        scale: 1, 
        rotateY: faceUp ? 0 : 180 
      }}
      whileHover={onClick ? { 
        scale: CASINO_THEME.card.hoverScale, 
        y: -10,
        boxShadow: glow ? CASINO_THEME.neon.boxShadow.cyan : CASINO_THEME.card.shadow
      } : {}}
      whileTap={onClick ? { scale: CASINO_THEME.card.activeScale } : {}}
      transition={{ 
        duration: parseFloat(CASINO_THEME.timing.cardFlip),
        ease: CASINO_THEME.timing.transition as any
      }}
      className={`relative cursor-${onClick ? 'pointer' : 'default'} ${className}`}
      style={{
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        transformStyle: 'preserve-3d',
        perspective: CASINO_THEME.table.perspective,
        ...style
      }}
    >
      {/* Front Face */}
      <div
        className="absolute inset-0 bg-white rounded-lg border-2 border-gray-300 flex flex-col justify-between p-1.5"
        style={{
          backfaceVisibility: 'hidden',
          transform: 'rotateY(0deg)',
          boxShadow: CASINO_THEME.card.shadow,
          borderRadius: CASINO_THEME.card.borderRadius
        }}
      >
        {/* Top-left corner */}
        <div className="flex flex-col items-center leading-none">
          <span 
            className="font-bold" 
            style={{ 
              fontSize: size === 'small' ? '0.875rem' : size === 'large' ? '1.5rem' : '1.125rem',
              color: SUIT_COLORS[suit]
            }}
          >
            {value}
          </span>
          <span 
            style={{ 
              fontSize: size === 'small' ? '1rem' : size === 'large' ? '1.75rem' : '1.25rem',
              color: SUIT_COLORS[suit]
            }}
          >
            {SUIT_SYMBOLS[suit]}
          </span>
        </div>

        {/* Center symbol (large) */}
        <div className="flex items-center justify-center flex-1">
          <span 
            style={{ 
              fontSize: size === 'small' ? '2rem' : size === 'large' ? '4rem' : '3rem',
              color: SUIT_COLORS[suit],
              textShadow: glow ? CASINO_THEME.neon.textShadow.cyan : 'none'
            }}
          >
            {SUIT_SYMBOLS[suit]}
          </span>
        </div>

        {/* Bottom-right corner (inverted) */}
        <div className="flex flex-col items-center leading-none" style={{ transform: 'rotate(180deg)' }}>
          <span 
            className="font-bold" 
            style={{ 
              fontSize: size === 'small' ? '0.875rem' : size === 'large' ? '1.5rem' : '1.125rem',
              color: SUIT_COLORS[suit]
            }}
          >
            {value}
          </span>
          <span 
            style={{ 
              fontSize: size === 'small' ? '1rem' : size === 'large' ? '1.75rem' : '1.25rem',
              color: SUIT_COLORS[suit]
            }}
          >
            {SUIT_SYMBOLS[suit]}
          </span>
        </div>
      </div>

      {/* Back Face */}
      <div
        className="absolute inset-0 rounded-lg overflow-hidden"
        style={{
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1e3a8a 100%)',
          boxShadow: CASINO_THEME.card.shadow,
          borderRadius: CASINO_THEME.card.borderRadius
        }}
      >
        {/* Card back pattern */}
        <div className="w-full h-full relative">
          {/* Border */}
          <div className="absolute inset-0 border-4 border-white/30 rounded-lg" />
          
          {/* Center pattern */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-3/4 h-3/4 rounded-lg border-2 border-white/40"
              style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
              }}
            />
          </div>
        </div>
      </div>

      {/* Neon glow effect (optional) */}
      {glow && faceUp && (
        <motion.div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.3) 0%, transparent 70%)',
            filter: CASINO_THEME.neon.blur,
            zIndex: -1
          }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.4, 0.8, 0.4]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      )}
    </motion.div>
  );
}
