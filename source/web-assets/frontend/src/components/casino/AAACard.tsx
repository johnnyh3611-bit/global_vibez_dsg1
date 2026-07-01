
import { motion } from 'framer-motion';

/**
 * AAA Digital Card Component - 2026 Cyberpunk Glassmorphism Design
 * Used across multiplayer casino games for consistent high-end aesthetics
 */

export const AAACard = ({ 
  card, 
  faceDown = false,
  dealAnimation = false,
  fromPosition = null,
  isFinalCard = false,
  size = 'md', // 'sm', 'md', 'lg'
  glowColor = null
}) => {
  // Size variants
  const sizes = {
    sm: 'w-12 h-18',
    md: 'w-16 h-24',
    lg: 'w-20 h-30'
  };

  const textSizes = {
    sm: { value: 'text-sm', suit: 'text-lg', center: 'text-3xl' },
    md: { value: 'text-base', suit: 'text-xl', center: 'text-4xl' },
    lg: { value: 'text-lg', suit: 'text-2xl', center: 'text-5xl' }
  };

  const getSuitSymbol = (suit) => {
    const suits = { 
      hearts: '♥', 
      diamonds: '♦', 
      clubs: '♣', 
      spades: '♠',
      'h': '♥',
      'd': '♦',
      'c': '♣',
      's': '♠'
    };
    return suits[suit?.toLowerCase()] || '';
  };

  const getSuitColor = (suit) => {
    const suitLower = suit?.toLowerCase();
    return (suitLower === 'hearts' || suitLower === 'diamonds' || suitLower === 'h' || suitLower === 'd') 
      ? 'text-red-500' 
      : 'text-black';
  };

  // Face down card
  if (!card || card.hidden || faceDown) {
    return (
      <motion.div
        initial={fromPosition ? { 
          x: fromPosition.x, 
          y: fromPosition.y, 
          opacity: 0, 
          rotateX: 180,
          scale: 0.8
        } : false}
        animate={{ 
          x: 0, 
          y: 0, 
          opacity: 1, 
          rotateX: 0,
          scale: 1
        }}
        transition={{ 
          type: 'spring', 
          damping: 18, 
          stiffness: 120,
          duration: isFinalCard ? 2.5 : 0.6
        }}
        className={`${sizes[size]} bg-gradient-to-br from-red-900/80 to-red-950/80 rounded-lg border-2 border-[#D4AF37]/50 flex items-center justify-center backdrop-blur-xl shadow-2xl`}
      >
        <div className="w-full h-full rounded-lg bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
      </motion.div>
    );
  }

  const dramaticTransition = isFinalCard ? {
    type: 'tween',
    ease: [0.16, 1, 0.3, 1] as any,
    duration: 2.5
  } : {
    type: 'spring',
    damping: 16,
    stiffness: 100,
    duration: 0.8
  };

  const cardGlow = glowColor || (isFinalCard ? '#D4AF37' : null);

  return (
    <motion.div
      initial={fromPosition ? { 
        x: fromPosition.x, 
        y: fromPosition.y, 
        opacity: 0, 
        rotateX: 180, 
        rotateZ: -15,
        scale: 0.7
      } : dealAnimation ? { 
        rotateY: 180, 
        scale: 0 
      } : false}
      animate={{ 
        x: 0, 
        y: 0, 
        opacity: 1, 
        rotateX: 0, 
        rotateY: 0, 
        rotateZ: 0,
        scale: isFinalCard ? [0.7, 1.15, 1] : 1
      }}
      transition={dramaticTransition as any}
      className={`relative ${sizes[size]} bg-white/95 backdrop-blur-xl rounded-lg border-2 ${
        isFinalCard || cardGlow
          ? `border-[${cardGlow}] shadow-[0_0_30px_${cardGlow}80]` 
          : 'border-white/20'
      } shadow-2xl`}
      style={cardGlow ? { 
        boxShadow: `0 0 30px ${cardGlow}80, 0 0 60px ${cardGlow}40`,
        borderColor: cardGlow
      } : {}}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-lg pointer-events-none" />
      
      {/* Card content */}
      <div className="absolute inset-0 flex flex-col items-center justify-between p-1.5">
        {/* Top corner */}
        <div className={`${getSuitColor(card.suit)} font-['JetBrains_Mono'] font-bold ${textSizes[size].value} leading-none`}>
          {card.value}
          <div className={`${textSizes[size].suit} leading-none`}>{getSuitSymbol(card.suit)}</div>
        </div>
        
        {/* Center suit */}
        <div className={`${getSuitColor(card.suit)} ${textSizes[size].center} opacity-20`}>
          {getSuitSymbol(card.suit)}
        </div>
        
        {/* Bottom corner (rotated) */}
        <div className={`${getSuitColor(card.suit)} font-['JetBrains_Mono'] font-bold ${textSizes[size].value} leading-none rotate-180`}>
          {card.value}
          <div className={`${textSizes[size].suit} leading-none`}>{getSuitSymbol(card.suit)}</div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * AAA UNO Card Component - Special styling for UNO
 */
export const AAAUnoCard = ({ 
  card, 
  size = 'md',
  selected = false,
  onClick = null,
  glowEffect = false
}) => {
  const sizes = {
    sm: 'w-12 h-18',
    md: 'w-16 h-24',
    lg: 'w-20 h-30'
  };

  const getUnoColor = (color) => {
    const colors = {
      red: 'from-red-500 to-red-700',
      blue: 'from-blue-500 to-blue-700',
      green: 'from-green-500 to-green-700',
      yellow: 'from-yellow-400 to-yellow-600',
      wild: 'from-purple-500 via-pink-500 to-orange-500'
    };
    return colors[color?.toLowerCase()] || 'from-gray-500 to-gray-700';
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.1, y: -10 }}
      whileTap={{ scale: 0.95 }}
      className={`${sizes[size]} bg-gradient-to-br ${getUnoColor(card.color)} rounded-xl border-4 border-white/30 cursor-pointer relative backdrop-blur-xl ${
        selected ? 'ring-4 ring-[#00F0FF] shadow-[0_0_30px_#00F0FF]' : ''
      } ${glowEffect ? 'shadow-[0_0_20px_rgba(255,255,255,0.6)]' : 'shadow-2xl'}`}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
      
      {/* Card content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[85%] h-[85%] bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center">
          <span className={`text-4xl font-black ${
            card.color === 'wild' ? 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent' : `text-${card.color}-600`
          }`}>
            {card.value}
          </span>
        </div>
      </div>

      {/* Top corner indicator */}
      <div className="absolute top-1 left-1 text-white text-xs font-bold opacity-70">
        {card.value}
      </div>
      
      {/* Bottom corner indicator (rotated) */}
      <div className="absolute bottom-1 right-1 text-white text-xs font-bold opacity-70 rotate-180">
        {card.value}
      </div>
    </motion.div>
  );
};

export default AAACard;
