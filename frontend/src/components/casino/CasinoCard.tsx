
import React from 'react';
import { motion } from 'framer-motion';

const SUITS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const SUIT_COLORS = {
  hearts: '#E63946',
  diamonds: '#E63946',
  clubs: '#1A1A1A',
  spades: '#1A1A1A'
};

interface CasinoCardProps {
  value?: any;
  suit?: any;
  isFaceUp?: boolean;
  className?: string;
  animate?: boolean;
  onClick?: () => void;
  [k: string]: any;
}

export default function CasinoCard({
  value,
  suit,
  isFaceUp = true,
  className = '',
  animate = true,
  onClick,
  ...props
}: CasinoCardProps) {
  const suitSymbol = SUITS[suit?.toLowerCase()] || '';
  const suitColor = SUIT_COLORS[suit?.toLowerCase()] || '#1A1A1A';

  const cardAnimation = animate ? {
    initial: { y: -200, scale: 0.5, opacity: 0, rotateY: 180 },
    animate: { y: 0, scale: 1, opacity: 1, rotateY: 0 },
    transition: { type: 'spring', stiffness: 200, damping: 20 }
  } : {};

  if (!isFaceUp) {
    return (
      <motion.div
        {...(cardAnimation as any)}
        className={`aspect-[5/7] w-20 md:w-32 lg:w-40 rounded-xl bg-gradient-to-br from-[#0F0818] to-[#1A0B2E] 
          border border-white/20 shadow-2xl relative overflow-hidden ${className}`}
        onClick={onClick}
        {...(props as any)}
      >
        {/* Card back pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full" 
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, #D4AF37 0, #D4AF37 1px, transparent 1px, transparent 6px),
                               repeating-linear-gradient(-45deg, #D4AF37 0, #D4AF37 1px, transparent 1px, transparent 6px)`,
            }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-4xl text-[#D4AF37] opacity-40 font-black">GV</div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      {...(cardAnimation as any)}
      whileHover={{ 
        y: -16, 
        rotate: -2, 
        boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
        zIndex: 50 
      }}
      className={`aspect-[5/7] w-20 md:w-32 lg:w-40 rounded-xl bg-[#F8F9FA] 
        border border-white/20 shadow-2xl relative overflow-hidden cursor-pointer 
        transition-all duration-300 ${className}`}
      onClick={onClick}
      data-testid={`card-${value}${suit}`}
      {...(props as any)}
    >
      {/* Subtle noise texture */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==")`
        }}
      />
      
      {/* Inner shadow for depth */}
      <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.05)] pointer-events-none" />

      {/* Top-left index */}
      <div 
        className="absolute top-2 left-2 leading-none"
        style={{ color: suitColor }}
      >
        <div className="text-2xl md:text-4xl font-black tracking-tighter font-serif">
          {value}
        </div>
        <div className="text-xl md:text-3xl -mt-1">
          {suitSymbol}
        </div>
      </div>

      {/* Center suit (large) */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl md:text-8xl opacity-20"
        style={{ color: suitColor }}
      >
        {suitSymbol}
      </div>

      {/* Bottom-right index (inverted) */}
      <div 
        className="absolute bottom-2 right-2 leading-none rotate-180"
        style={{ color: suitColor }}
      >
        <div className="text-2xl md:text-4xl font-black tracking-tighter font-serif">
          {value}
        </div>
        <div className="text-xl md:text-3xl -mt-1">
          {suitSymbol}
        </div>
      </div>

      {/* Worn edge effect */}
      <div className="absolute inset-0 rounded-xl shadow-[inset_0_0_3px_rgba(0,0,0,0.1)] pointer-events-none" />
    </motion.div>
  );
}
