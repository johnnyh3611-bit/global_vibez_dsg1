import { motion } from 'framer-motion';

/**
 * Modern animated playing card component
 * Supports flip animations, hover effects, and custom styling
 */
export const ModernCard = ({ 
  card, 
  onClick, 
  disabled = false, 
  selected = false,
  size = 'md',
  showBack = false 
}) => {
  const sizeClasses = {
    sm: 'w-16 h-24 text-lg',
    md: 'w-20 h-28 text-2xl',
    lg: 'w-28 h-40 text-3xl',
    xl: 'w-32 h-48 text-4xl'
  };

  const getCardColor = (suit) => {
    if (suit === '♥' || suit === '♦' || suit === 'H' || suit === 'D') return 'text-red-600';
    return 'text-gray-900';
  };

  const parsedCard = typeof card === 'string' ? {
    rank: card.slice(0, -1),
    suit: card.slice(-1)
  } : card;

  const suitSymbols = {
    'H': '♥️', 'D': '♦️', 'C': '♣️', 'S': '♠️',
    '♥': '♥️', '♦': '♦️', '♣': '♣️', '♠': '♠️'
  };

  const displaySuit = suitSymbols[parsedCard.suit] || parsedCard.suit;

  // If showing back, render the branded back only
  if (showBack) {
    return (
      <motion.div
        className={`${sizeClasses[size]} relative`}
        style={{ perspective: '1000px' }}
        whileHover={!disabled ? { scale: 1.05, y: -10 } : {}}
      >
        {/* Card Back - Global Vibez DSG Branded */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-2xl border-2 border-white/20 overflow-hidden">
          {/* Pattern */}
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '15px 15px'
            }}
          />
          {/* Logo */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <div className="text-2xl mb-1">❤️</div>
            <div className="font-black text-xs tracking-wider">GLOBAL</div>
            <div className="font-black text-xs tracking-wider">VIBES</div>
            <div className="text-xs mt-1">✨</div>
          </div>
          {/* Corners */}
          <div className="absolute top-1 left-1 text-white/40 text-[8px]">™</div>
          <div className="absolute top-1 right-1 text-white/40 text-[8px]">™</div>
          <div className="absolute bottom-1 left-1 text-white/40 text-[8px]">GV</div>
          <div className="absolute bottom-1 right-1 text-white/40 text-[8px]">GV</div>
        </div>
      </motion.div>
    );
  }

  // Render card front
  return (
    <motion.button
      onClick={!disabled ? onClick : null}
      disabled={disabled}
      className={`${sizeClasses[size]} relative group`}
      style={{ perspective: '1000px' }}
      whileHover={!disabled ? { scale: 1.05, y: -10 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      animate={{
        y: selected ? -20 : 0
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Card Front */}
      <div className={`absolute inset-0 rounded-xl bg-gradient-to-br from-white to-gray-100 shadow-2xl border-2 border-gray-300 p-2 flex flex-col justify-between ${
        selected ? 'ring-4 ring-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)]' : ''
      } ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}>
        {/* Top Corner */}
        <div className={`text-left ${getCardColor(parsedCard.suit)} font-bold leading-tight`}>
          <div>{parsedCard.rank}</div>
          <div className="text-sm">{displaySuit}</div>
        </div>
        
        {/* Center */}
        <div className={`text-center ${getCardColor(parsedCard.suit)} text-5xl`}>
          {displaySuit}
        </div>
        
        {/* Bottom Corner (rotated) */}
        <div className={`text-right ${getCardColor(parsedCard.suit)} font-bold leading-tight transform rotate-180`}>
          <div>{parsedCard.rank}</div>
          <div className="text-sm">{displaySuit}</div>
        </div>

        {/* Hover Glow */}
        {!disabled && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-cyan-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        )}
      </div>

      {/* Particle Effect on Hover */}
      {selected && (
        <motion.div
          className="absolute -inset-2 rounded-xl"
          animate={{
            boxShadow: [
              '0 0 20px rgba(6,182,212,0.3)',
              '0 0 40px rgba(6,182,212,0.6)',
              '0 0 20px rgba(6,182,212,0.3)'
            ]
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  );
};

export default ModernCard;
