import React from 'react';
import { motion } from 'framer-motion';
import { CASINO_THEME } from '@/utils/casinoTheme';

// Professional casino table with realistic felt texture and materials
// Supports Baccarat (oval), Blackjack (rounded rectangle), Poker (oval), Roulette (rectangular)

export default function CasinoTable3D({
  gameType = 'blackjack', // 'baccarat', 'blackjack', 'poker', 'roulette'
  children,
  className = '',
  showSpotlights = true
}) {
  const isOval = gameType === 'baccarat' || gameType === 'poker';
  const borderRadius = CASINO_THEME.table.borderRadius[gameType] || CASINO_THEME.table.borderRadius.blackjack;

  return (
    <div 
      className={`relative w-full h-full overflow-hidden ${className}`}
      style={{
        background: CASINO_THEME.colors.atmosphere.background
      }}
    >
      {/* Ambient glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
          style={{
            background: CASINO_THEME.colors.atmosphere.glow1,
            filter: CASINO_THEME.neon.blur
          }}
        />
        <div 
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full"
          style={{
            background: CASINO_THEME.colors.atmosphere.glow2,
            filter: CASINO_THEME.neon.blur
          }}
        />
      </div>

      {/* Spotlights (optional) */}
      {showSpotlights && (
        <motion.div
          className="absolute top-0 left-1/2 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(255,255,200,0.2) 0%, transparent 70%)',
            transform: 'translateX(-50%) translateY(-20%) rotateX(60deg)',
            filter: 'blur(30px)'
          }}
          animate={{
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      )}

      {/* Casino Table */}
      <div 
        className="relative z-10 mx-auto my-8"
        style={{
          maxWidth: isOval ? '900px' : '1000px',
          perspective: CASINO_THEME.table.perspective,
          transformStyle: 'preserve-3d'
        }}
      >
        {/* Table Shadow (3D depth) */}
        <div 
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            filter: 'blur(40px)',
            transform: 'translateY(20px)',
            zIndex: -1
          }}
        />

        {/* Wood Rail (Padding) */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius,
            background: `linear-gradient(145deg, ${CASINO_THEME.colors.materials.wood}, ${CASINO_THEME.colors.materials.woodDark})`,
            padding: CASINO_THEME.table.felt.padding,
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), inset 0 -5px 20px rgba(0, 0, 0, 0.5)'
          }}
        >
          {/* Wood grain texture simulation */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              background: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
            }}
          />

          {/* Green Felt Playing Surface */}
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: 'inherit',
              background: CASINO_THEME.colors.felt.gradient,
              minHeight: '600px',
              boxShadow: CASINO_THEME.table.felt.shadow
            }}
          >
            {/* Felt texture */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" /%3E%3C/filter%3E%3Crect width="100" height="100" filter="url(%23noise)" opacity="0.3"/%3E%3C/svg%3E")',
                backgroundSize: '100px 100px'
              }}
            />

            {/* Subtle radial highlight (center of table) */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, transparent 60%)'
              }}
            />

            {/* Game-specific markings (optional - can be added via children) */}
            <div className="relative z-10 p-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
