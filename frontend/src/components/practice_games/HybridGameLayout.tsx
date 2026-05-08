import React from 'react';
import { motion } from 'framer-motion';
import { PlayerCardHand } from './PlayerCardHand';

/**
 * HybridGameLayout - Option C/D Style
 * Balanced 3D perspective with large prominent cards
 * Purple/cyan neon cyberpunk aesthetic
 */
export function HybridGameLayout({ children,
  playerHand = [],
  onCardClick,
  disabled = false,
  topContent,
  centerContent,
  stats }: { children?: any, playerHand?: any, onCardClick?: any, disabled?: any, topContent?: any, centerContent?: any, stats?: any }) {
  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-gray-900 via-purple-900/20 to-black overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(rgba(168, 85, 247, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(168, 85, 247, 0.3) 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      {/* Neon glow effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[120px]"
        />
        <motion.div
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600 rounded-full blur-[120px]"
        />
      </div>

      {/* Top stats/info bar */}
      {stats && (
        <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center">
          {stats}
        </div>
      )}

      {/* Top content area (opponent, community cards, etc) */}
      {topContent && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10">
          {topContent}
        </div>
      )}

      {/* Center game area with gentle 3D perspective */}
      <div className="absolute inset-0 flex items-center justify-center" style={{
        perspective: '1200px',
        perspectiveOrigin: '50% 40%'
      }}>
        <div 
          className="relative w-full max-w-4xl"
          style={{
            transform: 'rotateX(10deg)',
            transformStyle: 'preserve-3d'
          }}
        >
          {/* Game table surface - subtle 3D */}
          <div className="relative rounded-3xl overflow-hidden border-4 border-purple-500/30 shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(30, 20, 50, 0.9), rgba(20, 10, 40, 0.95))',
              boxShadow: '0 20px 60px rgba(168, 85, 247, 0.3), inset 0 0 40px rgba(168, 85, 247, 0.1)'
            }}
          >
            {/* Felt texture overlay */}
            <div className="absolute inset-0 opacity-30" style={{
              backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.2) 0%, transparent 50%)',
              backgroundSize: '50px 50px'
            }} />
            
            {/* Center content (cards on table, pot, etc) */}
            <div className="relative z-10 p-8 min-h-[300px] flex items-center justify-center">
              {centerContent}
            </div>
          </div>
        </div>
      </div>

      {/* Additional children overlay */}
      {children}

      {/* Player hand - large prominent curved cards at bottom */}
      {playerHand && playerHand.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 z-30">
          <PlayerCardHand
            cards={playerHand}
            onCardClick={onCardClick}
            disabled={disabled}
          />
        </div>
      )}

      {/* Bottom gradient fade for card blending */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none z-20" />
    </div>
  );
}

/**
 * StatBadge - Reusable player stat component
 */
export function StatBadge({ label, value, position = 'top-left', color = 'purple' }: { label?: any, value?: any, position?: any, color?: any }) {
  const positions = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const colors = {
    purple: 'from-purple-600 to-fuchsia-600 border-purple-400',
    cyan: 'from-cyan-600 to-blue-600 border-cyan-400',
    green: 'from-green-600 to-emerald-600 border-green-400'
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`absolute ${positions[position]} z-20`}
    >
      <div className={`bg-gradient-to-br ${colors[color]} px-4 py-2 rounded-xl border-2 backdrop-blur-sm shadow-xl`}
        style={{ boxShadow: '0 0 20px rgba(168, 85, 247, 0.5)' }}
      >
        <p className="text-white/70 text-xs font-bold">{label}</p>
        <p className="text-white text-xl font-black">{value}</p>
      </div>
    </motion.div>
  );
}

/**
 * FloatingButton - Reusable action button
 */
export function FloatingButton({ onClick, children, disabled, color = 'purple', position }: { onClick?: any, children?: any, disabled?: any, color?: any, position?: any }) {
  const colors = {
    purple: 'from-purple-600 to-fuchsia-700 hover:from-purple-700 hover:to-fuchsia-800 border-purple-400',
    cyan: 'from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 border-cyan-400',
    red: 'from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border-red-400',
    green: 'from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 border-green-400'
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`bg-gradient-to-r ${colors[color]} disabled:opacity-50 disabled:cursor-not-allowed text-white font-black px-6 py-3 rounded-xl border-2 shadow-xl transition-all ${position || ''}`}
      style={{ boxShadow: '0 0 30px rgba(168, 85, 247, 0.5)' }}
    >
      {children}
    </motion.button>
  );
}
