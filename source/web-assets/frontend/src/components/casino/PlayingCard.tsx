import React from 'react';
import { motion } from 'framer-motion';

/**
 * Universal Playing Card Component
 * Supports 4 visual styles: realistic, modern, cyberpunk, luxury
 */

const SUIT_SYMBOLS = {
  'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣',
  'spades': '♠', 'hearts': '♥', 'diamonds': '♦', 'clubs': '♣'
};

const SUIT_COLORS = {
  'S': 'text-black', 'spades': 'text-black', 'C': 'text-black', 'clubs': 'text-black',
  'H': 'text-red-600', 'hearts': 'text-red-600', 'D': 'text-red-600', 'diamonds': 'text-red-600'
};

const parseCard = (cardStr) => {
  if (!cardStr || cardStr === 'BACK') return { rank: '?', suit: 'BACK', isBack: true };
  
  // Handle card objects (e.g., from Spades backend: {suit, rank, value})
  if (typeof cardStr === 'object' && cardStr.rank && cardStr.suit) {
    return {
      rank: cardStr.rank.toUpperCase(),
      suit: cardStr.suit.toUpperCase()[0] || cardStr.suit,
      isBack: false
    };
  }
  
  // Convert to string if not already
  const card = String(cardStr);
  
  // Handle formats like "AS", "10H", "KD", "2C"
  const match = card.match(/^(\d{1,2}|[AKQJ])([SHDC]|spades|hearts|diamonds|clubs)$/i);
  if (!match) return { rank: card[0] || '?', suit: card[1] || 'S', isBack: false };
  
  return {
    rank: match[1].toUpperCase(),
    suit: match[2].toUpperCase()[0] || match[2],
    isBack: false
  };
};

interface PlayingCardProps {
  card?: any;
  style?: string;
  size?: string;
  isFlipped?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  animateIn?: boolean;
  delay?: number;
}

export default function PlayingCard({
  card,
  style = 'realistic', // realistic, modern, cyberpunk, luxury
  size = 'normal', // small, normal, large
  isFlipped = false,
  isSelected = false,
  onClick,
  className = '',
  animateIn = false,
  delay = 0,
}: PlayingCardProps) {
  const { rank, suit, isBack } = parseCard(card);
  const suitSymbol = SUIT_SYMBOLS[suit] || '♠';
  const suitColor = SUIT_COLORS[suit] || 'text-black';

  const sizeClasses = {
    small: 'w-16 h-24 text-sm',
    normal: 'w-20 h-32 text-lg',
    large: 'w-28 h-40 text-2xl'
  };

  // Style A: Realistic Casino Cards
  const RealisticCard = () => (
    <div className={`relative ${sizeClasses[size]} bg-white rounded-lg shadow-2xl border-2 border-gray-200 overflow-hidden ${isSelected ? 'ring-4 ring-yellow-400' : ''}`}>
      {/* Glossy shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent pointer-events-none" />
      
      {/* Corner pips - Top Left */}
      <div className={`absolute top-1 left-1 flex flex-col items-center ${suitColor}`}>
        <span className="font-bold leading-none">{rank}</span>
        <span className="text-xs">{suitSymbol}</span>
      </div>
      
      {/* Corner pips - Bottom Right (rotated) */}
      <div className={`absolute bottom-1 right-1 flex flex-col items-center ${suitColor} rotate-180`}>
        <span className="font-bold leading-none">{rank}</span>
        <span className="text-xs">{suitSymbol}</span>
      </div>
      
      {/* Center suit symbol */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${suitColor} opacity-20`} style={{ fontSize: size === 'large' ? '4rem' : size === 'normal' ? '3rem' : '2rem' }}>
          {suitSymbol}
        </span>
      </div>
    </div>
  );

  // Style B: Modern Minimalist
  const ModernCard = () => {
    const suitBg = {
      'S': 'bg-gradient-to-br from-gray-800 to-black',
      'C': 'bg-gradient-to-br from-gray-800 to-black',
      'H': 'bg-gradient-to-br from-red-600 to-red-800',
      'D': 'bg-gradient-to-br from-red-600 to-red-800'
    };
    
    return (
      <div className={`relative ${sizeClasses[size]} ${suitBg[suit] || suitBg['S']} rounded-2xl shadow-xl overflow-hidden ${isSelected ? 'ring-4 ring-cyan-400' : ''}`}>
        {/* Large centered content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <span className="font-black" style={{ fontSize: size === 'large' ? '3rem' : size === 'normal' ? '2rem' : '1.5rem' }}>
            {rank}
          </span>
          <span className="text-white/80 mt-1" style={{ fontSize: size === 'large' ? '2rem' : size === 'normal' ? '1.5rem' : '1rem' }}>
            {suitSymbol}
          </span>
        </div>
      </div>
    );
  };

  // Style C: Cyberpunk Holographic
  const CyberpunkCard = () => (
    <div className={`relative ${sizeClasses[size]} bg-black/80 backdrop-blur-sm rounded-xl overflow-hidden border-2 ${isSelected ? 'border-pink-500 shadow-pink-500/50' : 'border-cyan-500/50'} shadow-2xl`}>
      {/* Neon glow edge */}
      <div className={`absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 ${isSelected ? 'opacity-100' : 'opacity-60'}`} />
      
      {/* Scan lines */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/5 to-transparent animate-scan pointer-events-none" />
      
      {/* Corner indicators */}
      <div className="absolute top-1 left-1 text-cyan-400 font-bold text-xs">
        {rank}
      </div>
      
      {/* Center holographic suit */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 via-purple-400 to-pink-400" 
              style={{ fontSize: size === 'large' ? '4rem' : size === 'normal' ? '3rem' : '2rem' }}>
          {suitSymbol}
        </span>
      </div>
      
      {/* Bottom rank */}
      <div className="absolute bottom-1 right-1 text-pink-400 font-bold text-xs rotate-180">
        {rank}
      </div>
      
      {/* Particles */}
      {isSelected && (
        <>
          <div className="absolute top-2 right-2 w-1 h-1 bg-cyan-400 rounded-full animate-ping" />
          <div className="absolute bottom-2 left-2 w-1 h-1 bg-pink-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
        </>
      )}
    </div>
  );

  // Style D: Luxury Gold
  const LuxuryCard = () => (
    <div className={`relative ${sizeClasses[size]} bg-gradient-to-br from-gray-900 via-black to-gray-900 rounded-lg shadow-2xl border-2 ${isSelected ? 'border-yellow-400' : 'border-yellow-600/50'} overflow-hidden`}>
      {/* Gold foil effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-yellow-600/10 pointer-events-none" />
      
      {/* Ornate corners */}
      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-yellow-500/80" />
      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-yellow-500/80" />
      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-yellow-500/80" />
      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-yellow-500/80" />
      
      {/* Rank indicators */}
      <div className="absolute top-2 left-2 text-yellow-400 font-bold text-shadow-gold">
        <div className="text-xs">{rank}</div>
        <div className="text-xs mt-0.5">{suitSymbol}</div>
      </div>
      
      {/* Center ornate suit */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-yellow-500/30 filter drop-shadow-2xl" 
              style={{ fontSize: size === 'large' ? '5rem' : size === 'normal' ? '3.5rem' : '2.5rem' }}>
          {suitSymbol}
        </span>
      </div>
      
      {/* Bottom rank (rotated) */}
      <div className="absolute bottom-2 right-2 text-yellow-400 font-bold text-shadow-gold rotate-180">
        <div className="text-xs">{rank}</div>
        <div className="text-xs mt-0.5">{suitSymbol}</div>
      </div>
      
      {/* Metallic sheen */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-yellow-500/5 to-transparent pointer-events-none" />
    </div>
  );

  // Card back design
  const CardBack = () => (
    <div className={`relative ${sizeClasses[size]} bg-gradient-to-br from-red-700 via-red-800 to-red-900 rounded-lg shadow-2xl border-2 border-red-600 overflow-hidden`}>
      {/* Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.1)_0%,transparent_50%)]" 
             style={{ backgroundSize: '20px 20px' }} />
      </div>
      
      {/* Center logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-4xl opacity-50">🎮</div>
      </div>
    </div>
  );

  // Render appropriate style
  const renderCard = () => {
    if (isBack || isFlipped) return <CardBack />;
    
    switch (style) {
      case 'modern': return <ModernCard />;
      case 'cyberpunk': return <CyberpunkCard />;
      case 'luxury': return <LuxuryCard />;
      case 'realistic':
      default: return <RealisticCard />;
    }
  };

  return (
    <motion.div
      initial={animateIn ? { scale: 0, rotate: -180, y: -100 } : false}
      animate={{ scale: 1, rotate: 0, y: 0 }}
      transition={{ 
        type: 'spring', 
        stiffness: 200, 
        damping: 20,
        delay 
      }}
      whileHover={onClick ? { scale: 1.05, y: -10 } : {}}
      whileTap={onClick ? { scale: 0.95 } : {}}
      onClick={onClick}
      className={`cursor-pointer ${className}`}
    >
      {renderCard()}
    </motion.div>
  );
}
