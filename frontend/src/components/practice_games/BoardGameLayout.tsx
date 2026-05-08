import React from 'react';
import { motion } from 'framer-motion';

/**
 * BoardGameLayout - Mobile-First Responsive Layout
 * For Chess, Checkers, Tic-Tac-Toe, Connect 4, Reversi
 * Optimized for 375px-1920px screens with AAA animations
 */
export function BoardGameLayout({ children,
  gameBoard,
  topLeftStat,
  topRightStat,
  bottomActions,
  gameTitle }: { children?: any, gameBoard?: any, topLeftStat?: any, topRightStat?: any, bottomActions?: any, gameTitle?: any }) {
  return (
    <div 
      className="min-h-screen w-full relative overflow-x-hidden bg-[#050508] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0A0A1A] via-[#050508] to-black text-white flex flex-col"
      style={{ WebkitFontSmoothing: 'antialiased' }}
    >
      {/* Ambient lighting effects - RESPONSIVE */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/3 w-32 h-32 sm:w-48 sm:h-48 md:w-72 md:h-72 lg:w-96 lg:h-96 bg-purple-600/20 rounded-full blur-[60px] sm:blur-[100px] lg:blur-[150px]" />
        <div className="absolute bottom-1/3 right-1/4 w-32 h-32 sm:w-48 sm:h-48 md:w-72 md:h-72 lg:w-96 lg:h-96 bg-cyan-600/20 rounded-full blur-[60px] sm:blur-[100px] lg:blur-[150px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 md:w-96 md:h-96 lg:w-[500px] lg:h-[500px] bg-fuchsia-600/10 rounded-full blur-[80px] sm:blur-[120px] lg:blur-[180px]" />
      </div>

      {/* Top Stats Bar - MOBILE OPTIMIZED */}
      <div className="w-full py-3 px-3 sm:py-4 sm:px-6 md:px-8 flex justify-between items-center bg-white/5 backdrop-blur-xl border-b border-white/10 z-50 sticky top-0">
        <div className="flex-shrink-0">{topLeftStat}</div>
        {gameTitle && <div className="mx-2 sm:mx-4 flex-shrink">{gameTitle}</div>}
        <div className="flex-shrink-0">{topRightStat}</div>
      </div>

      {/* Main Game Board Area - RESPONSIVE PADDING */}
      <div 
        className="flex-1 flex items-center justify-center px-2 sm:px-4 md:px-6"
        style={{
          paddingTop: 'clamp(20px, 8vh, 60px)',
          paddingBottom: 'clamp(20px, 8vh, 60px)'
        }}
      >
        <div className="relative w-full max-w-[min(100vw-16px,500px)] sm:max-w-[min(100vw-32px,600px)] lg:max-w-[700px]">
          {/* Board Container with subtle 3D effect - MOBILE SAFE */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden shadow-2xl border-2 sm:border-4 border-purple-500/30"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(26, 31, 53, 0.95) 0%, rgba(10, 14, 26, 0.98) 70%)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 0 40px rgba(168, 85, 247, 0.1), 0 0 30px rgba(168, 85, 247, 0.2)',
              WebkitBackfaceVisibility: 'hidden',
              willChange: 'transform'
            }}
          >
            {/* Inner glow */}
            <div className="absolute inset-0 border-2 sm:border-4 border-cyan-500/20 rounded-xl sm:rounded-2xl lg:rounded-3xl" />
            
            {/* Game board - RESPONSIVE PADDING */}
            <div className="relative z-10 p-3 sm:p-4 md:p-6">
              {gameBoard}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Actions - MOBILE SAFE */}
      {bottomActions && (
        <div className="w-full pb-4 sm:pb-6 md:pb-8 flex justify-center z-30 px-4">
          {bottomActions}
        </div>
      )}

      {/* Additional content overlay */}
      {children}

      {/* Bottom gradient fade - RESPONSIVE */}
      <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-24 md:h-32 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-10" />
    </div>
  );
}

/**
 * BoardStatBadge - Mobile-First Responsive Stat Badge
 */
export function BoardStatBadge({ label, value, color = 'purple', icon }: { label?: any, value?: any, color?: any, icon?: any }) {
  const colors = {
    purple: 'from-purple-600 to-fuchsia-600 border-purple-400',
    cyan: 'from-cyan-600 to-blue-600 border-cyan-400',
    red: 'from-red-600 to-rose-600 border-red-400',
    green: 'from-green-600 to-emerald-600 border-green-400',
    yellow: 'from-yellow-600 to-amber-600 border-yellow-400'
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.175, 0.885, 0.32, 1.275] }}
      className={`bg-gradient-to-br ${colors[color]} px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2.5 lg:px-5 lg:py-3 rounded-lg sm:rounded-xl lg:rounded-2xl border border-2 shadow-2xl backdrop-blur-sm [-webkit-tap-highlight-color:transparent]`}
      style={{ 
        boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)',
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
 * BoardActionButton - Mobile-First Touch-Optimized Button
 */
export function BoardActionButton({ onClick, children, disabled, color = 'purple' }: { onClick?: any, children?: any, disabled?: any, color?: any }) {
  const colors = {
    purple: 'from-purple-600 to-fuchsia-700 hover:from-purple-700 hover:to-fuchsia-800 active:from-purple-800 active:to-fuchsia-900 border-purple-400',
    cyan: 'from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 active:from-cyan-800 active:to-blue-900 border-cyan-400',
    red: 'from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 active:from-red-800 active:to-rose-900 border-red-400',
    green: 'from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 active:from-green-800 active:to-emerald-900 border-green-400',
    yellow: 'from-yellow-600 to-amber-700 hover:from-yellow-700 hover:to-amber-800 active:from-yellow-800 active:to-amber-900 border-yellow-400'
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
      `}
      style={{ 
        boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)',
        willChange: 'transform'
      }}
    >
      {children}
    </motion.button>
  );
}
