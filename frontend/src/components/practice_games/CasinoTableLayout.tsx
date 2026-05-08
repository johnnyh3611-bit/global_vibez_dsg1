import React from 'react';
import { motion } from 'framer-motion';

/**
 * CasinoTableLayout - Mobile-First Responsive Casino Table
 * For UNO, Poker, Blackjack, Hearts, Spades, Go Fish, Crazy Eights
 * Optimized for 375px-1920px screens with AAA animations
 */
export function CasinoTableLayout({ playerHand = [],
  onCardClick,
  disabled = false,
  centerContent,
  topLeftStat,
  topRightStat,
  gameTitle,
  bottomContent }: { playerHand?: any, onCardClick?: any, disabled?: any, centerContent?: any, topLeftStat?: any, topRightStat?: any, gameTitle?: any, bottomContent?: any }) {
  return (
    <div 
      className="min-h-screen w-full relative overflow-x-hidden bg-[#050508] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0A0A1A] via-[#050508] to-black text-white flex flex-col"
      style={{ WebkitFontSmoothing: 'antialiased' }}
    >
      {/* Ambient lighting effects - RESPONSIVE */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-32 h-32 sm:w-48 sm:h-48 md:w-72 md:h-72 lg:w-96 lg:h-96 bg-purple-600/20 rounded-full blur-[60px] sm:blur-[100px] lg:blur-[150px]" />
        <div className="absolute bottom-1/3 right-1/4 w-32 h-32 sm:w-48 sm:h-48 md:w-72 md:h-72 lg:w-96 lg:h-96 bg-fuchsia-600/20 rounded-full blur-[60px] sm:blur-[100px] lg:blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 lg:w-[500px] lg:h-[500px] bg-cyan-600/10 rounded-full blur-[80px] sm:blur-[120px] lg:blur-[180px]" />
      </div>

      {/* Top Stats Bar - MOBILE OPTIMIZED */}
      <div className="w-full py-3 px-3 sm:py-4 sm:px-6 md:px-8 flex justify-between items-center bg-white/5 backdrop-blur-xl border-b border-white/10 z-50 sticky top-0">
        <div className="flex-shrink-0">{topLeftStat}</div>
        {gameTitle && <div className="mx-2 sm:mx-4 flex-shrink">{gameTitle}</div>}
        <div className="flex-shrink-0">{topRightStat}</div>
      </div>

      {/* Main Casino Table Container - RESPONSIVE HEIGHT */}
      <div className="flex-1 relative w-full h-[65vh] sm:h-[70vh] md:h-[75vh] flex flex-col justify-between items-center py-4 sm:py-6 md:py-8">
        
        {/* Casino Table Surface - MOBILE ADAPTED */}
        <div 
          className="absolute inset-4 sm:inset-6 md:inset-8 rounded-2xl sm:rounded-3xl lg:rounded-[4rem] border border-white/10 overflow-hidden pointer-events-none"
          style={{
            background: '#0B0B12',
            boxShadow: 'inset 0 0 80px rgba(0,229,255,0.05)'
          }}
        >
          {/* Subtle grid lines */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
              backgroundSize: '30px 30px sm:40px 40px',
              maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, #000 70%, transparent 100%)'
            }}
          />
        </div>

        {/* Center Content Area - RESPONSIVE */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 md:px-8 w-full">
          {centerContent}
        </div>

        {/* Bottom Content (actions, buttons) - MOBILE SAFE */}
        {bottomContent && (
          <div className="relative z-10 w-full px-4 sm:px-6 md:px-8 pb-4 flex flex-col items-center gap-3 sm:gap-4">
            {bottomContent}
          </div>
        )}
      </div>

      {/* Player Hand - RESPONSIVE CARD FAN */}
      {playerHand && playerHand.length > 0 && (
        <div className="relative z-20 pb-4 sm:pb-6 md:pb-8 w-full px-2 sm:px-4">
          <div className="flex justify-center items-end -space-x-8 sm:-space-x-6 md:-space-x-4 max-w-4xl mx-auto overflow-visible touch-pan-x">
            {playerHand.map((card, index) => (
              <motion.div
                key={`player-${card.suit}-${card.value}-${index}`}
                initial={{ y: 300, opacity: 0, rotate: -180 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{ 
                  duration: 0.5, 
                  ease: [0.34, 1.56, 0.64, 1], 
                  delay: index * 0.05 
                }}
                whileHover={{ 
                  y: -32, 
                  scale: 1.05,
                  zIndex: 50,
                  transition: { duration: 0.2 }
                }}
                whileTap={{ scale: 0.95 }}
                onClick={() => !disabled && onCardClick && onCardClick(card, index)}
                className="
                  w-14 h-20 sm:w-16 sm:h-24 md:w-20 md:h-28 lg:w-24 lg:h-36
                  rounded-lg sm:rounded-xl cursor-pointer
                  origin-bottom
                  touch-manipulation [-webkit-tap-highlight-color:transparent]
                  will-change-transform
                "
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(240,240,250,0.95))',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
                  WebkitBackfaceVisibility: 'hidden',
                  minWidth: '44px',
                  minHeight: '44px'
                }}
              >
                {card}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * CasinoStatBadge - Mobile-First Casino Stats Display
 */
export function CasinoStatBadge({ label, value, color = 'cyan', icon }: { label?: any, value?: any, color?: any, icon?: any }) {
  const colors = {
    cyan: 'from-cyan-600 to-blue-600 border-cyan-400',
    purple: 'from-purple-600 to-fuchsia-600 border-purple-400',
    gold: 'from-yellow-600 to-amber-600 border-yellow-400',
    red: 'from-red-600 to-rose-600 border-red-400',
    green: 'from-green-600 to-emerald-600 border-green-400'
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.175, 0.885, 0.32, 1.275] }}
      className={`bg-gradient-to-br ${colors[color]} px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2.5 lg:px-5 lg:py-3 rounded-lg sm:rounded-xl lg:rounded-2xl border border-2 shadow-2xl backdrop-blur-sm [-webkit-tap-highlight-color:transparent]`}
      style={{ 
        boxShadow: '0 0 20px rgba(0, 229, 255, 0.5)',
        willChange: 'transform'
      }}
    >
      <p className="text-white/70 text-[10px] sm:text-xs font-bold leading-tight">{label}</p>
      <p className="text-white text-sm sm:text-lg md:text-xl lg:text-2xl font-black flex items-center gap-1 sm:gap-2 leading-tight">
        {icon && <span className="text-xs sm:text-base md:text-lg lg:text-xl">{icon}</span>}
        {value}
      </p>
    </motion.div>
  );
}

/**
 * CasinoActionButton - Mobile-First Touch-Optimized Casino Button
 */
export function CasinoActionButton({ onClick, children, disabled, color = 'cyan', icon }: { onClick?: any, children?: any, disabled?: any, color?: any, icon?: any }) {
  const colors = {
    cyan: 'from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 active:from-cyan-800 active:to-blue-900 border-cyan-400',
    purple: 'from-purple-600 to-fuchsia-700 hover:from-purple-700 hover:to-fuchsia-800 active:from-purple-800 active:to-fuchsia-900 border-purple-400',
    red: 'from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 active:from-red-800 active:to-rose-900 border-red-400',
    green: 'from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 active:from-green-800 active:to-emerald-900 border-green-400',
    gold: 'from-yellow-600 to-amber-700 hover:from-yellow-700 hover:to-amber-800 active:from-yellow-800 active:to-amber-900 border-yellow-400'
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`
        bg-gradient-to-r ${colors[color]} 
        disabled:opacity-50 disabled:cursor-not-allowed 
        text-white font-black 
        px-4 py-3 sm:px-6 sm:py-3.5 md:px-8 md:py-4 
        text-sm sm:text-base md:text-lg
        rounded-xl sm:rounded-2xl border-2 shadow-xl 
        transition-all touch-manipulation
        [-webkit-tap-highlight-color:transparent]
        min-h-[44px] min-w-[44px]
        flex items-center gap-2
      `}
      style={{ 
        boxShadow: '0 0 30px rgba(0, 229, 255, 0.5)',
        willChange: 'transform'
      }}
    >
      {icon && <span className="text-lg sm:text-xl md:text-2xl">{icon}</span>}
      {children}
    </motion.button>
  );
}
