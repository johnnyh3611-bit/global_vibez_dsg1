
/**
 * Enhanced Card Component with "Juice"
 * AAA-quality card with physics, sound, particles, and haptics
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import cardSoundManager from '@/utils/cardSoundManager';
import { 
  useCardBendAnimation, 
  cardGlowStyles,
  tableReflectionStyles 
} from '@/utils/cardAnimations';

const SUITS = {
  'spades': '♠',
  'hearts': '♥',
  'diamonds': '♦',
  'clubs': '♣'
};

const SUIT_COLORS = {
  'spades': '#000000',
  'hearts': '#dc2626',
  'diamonds': '#dc2626',
  'clubs': '#000000'
};

export default function EnhancedCard({ 
  card, 
  onClick, 
  disabled = false, 
  selected = false,
  isDealing = false,
  index = 0,
  showParticles = true,
  size = 'medium' // small, medium, large
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  const suitSymbol = SUITS[card.suit];
  const suitColor = SUIT_COLORS[card.suit];

  const bendStyles = useCardBendAnimation(isHovered && !disabled);
  const glowStyles = cardGlowStyles(selected, selected ? '#fbbf24' : suitColor);

  const sizeClasses = {
    small: 'w-16 h-24',
    medium: 'w-20 h-32',
    large: 'w-24 h-36'
  };

  const handleClick = (e) => {
    if (disabled) return;

    // Play sound
    cardSoundManager.playCardSlam();

    // Trigger onClick callback
    if (onClick) {
      onClick(card, e);
    }
  };

  const handleMouseEnter = () => {
    if (disabled) return;
    setIsHovered(true);
    cardSoundManager.playCardFlip();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Deal animation
  const dealAnimation = isDealing ? {
    initial: { 
      x: 0, 
      y: -200, 
      opacity: 0, 
      rotate: -180,
      scale: 0.5
    },
    animate: { 
      x: 0, 
      y: 0, 
      opacity: 1, 
      rotate: index * 1.5 - 10,
      scale: 1,
      transition: {
        delay: index * 0.08,
        duration: 0.4,
        ease: [0.34, 1.56, 0.64, 1]
      }
    }
  } : {};

  // Hover animation
  const hoverAnimation = !disabled ? {
    y: -15,
    scale: 1.05,
    transition: { type: "spring", stiffness: 300, damping: 20 }
  } : {};

  return (
    <div className="relative inline-block">
      <motion.button
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        disabled={disabled}
        whileHover={hoverAnimation as any}
        whileTap={!disabled ? { scale: 0.95 } : {}}
        {...(dealAnimation as any)}
        className={`
          ${sizeClasses[size]}
          bg-gradient-to-br from-white to-gray-50
          rounded-lg relative overflow-hidden
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          flex flex-col items-center justify-between p-2
          transition-all duration-200
        `}
        style={{
          ...bendStyles,
          ...glowStyles,
          border: selected ? '3px solid #fbbf24' : '2px solid #d1d5db',
          filter: disabled ? 'grayscale(0.3)' : 'none'
        }}
      >
        {/* Card texture overlay */}
        <div 
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h60v60H0z' fill='none'/%3E%3Cpath d='M30 30l30-30M0 30l30 30M30 0L0 30' stroke='%23000' stroke-width='1' opacity='.1'/%3E%3C/svg%3E")`,
            backgroundSize: '20px 20px'
          }}
        />

        {/* Top rank & suit */}
        <div className="flex flex-col items-center z-10">
          <div 
            className="text-2xl font-bold font-['Crimson_Text']"
            style={{ color: suitColor }}
          >
            {card.rank}
          </div>
          <div className="text-3xl leading-none" style={{ color: suitColor }}>
            {suitSymbol}
          </div>
        </div>

        {/* Center suit (large) */}
        <div 
          className="text-5xl opacity-20 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ color: suitColor }}
        >
          {suitSymbol}
        </div>

        {/* Bottom rank & suit (rotated) */}
        <div className="flex flex-col items-center z-10 rotate-180">
          <div 
            className="text-2xl font-bold font-['Crimson_Text']"
            style={{ color: suitColor }}
          >
            {card.rank}
          </div>
          <div className="text-3xl leading-none" style={{ color: suitColor }}>
            {suitSymbol}
          </div>
        </div>

        {/* Shine effect on hover */}
        {isHovered && !disabled && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}

        {/* Selected indicator */}
        {selected && (
          <motion.div
            className="absolute -top-1 -right-1 bg-amber-500 rounded-full w-5 h-5 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            <span className="text-white text-xs font-bold">✓</span>
          </motion.div>
        )}
      </motion.button>

      {/* Table reflection */}
      {!isDealing && (
        <div style={tableReflectionStyles as React.CSSProperties} />
      )}
    </div>
  );
}

/**
 * Card Back Component (for opponent cards or deck)
 */
export function CardBack({ onClick, disabled = false, size = 'medium' }: { onClick?: () => void; disabled?: boolean; size?: 'small' | 'medium' | 'large' }) {
  const sizeClasses = {
    small: 'w-16 h-24',
    medium: 'w-20 h-32',
    large: 'w-24 h-36'
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      className={`
        ${sizeClasses[size]}
        bg-gradient-to-br from-red-900 to-red-950
        rounded-lg border-2 border-yellow-700/40
        shadow-[0_0_15px_rgba(0,0,0,0.8)]
        relative overflow-hidden
        ${disabled ? 'cursor-default' : 'cursor-pointer'}
      `}
    >
      {/* Card back pattern */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='10' height='10' patternUnits='userSpaceOnUse'%3E%3Crect width='10' height='10' fill='none' stroke='%23333' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Border decoration */}
      <div className="absolute inset-0 border-4 border-yellow-900/20 rounded-lg" />
    </motion.button>
  );
}
