import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Volume2, VolumeX } from 'lucide-react';
import { CASINO_THEME } from '@/utils/casinoTheme';

// Dealer controls and game state display
// Glassmorphism HUD with state indicators

const GAME_STATES = {
  BETTING_OPEN: { text: 'PLACE YOUR BETS', color: CASINO_THEME.colors.neon.cyan },
  NO_MORE_BETS: { text: 'NO MORE BETS', color: CASINO_THEME.colors.neon.pink },
  DEALING: { text: 'DEALING...', color: CASINO_THEME.colors.neon.purple },
  PLAYING: { text: 'GOOD LUCK', color: CASINO_THEME.colors.neon.gold },
  RESULT: { text: 'RESULT', color: CASINO_THEME.colors.neon.green },
  PAYOUT: { text: 'PAYING OUT...', color: CASINO_THEME.colors.neon.gold }
};

export default function DealerUIPanel({
  gameState = 'BETTING_OPEN',
  dealerMessage = '',
  soundEnabled = true,
  onToggleSound,
  onShowRules,
  stats = null,
  className = ''
}) {
  const currentState = GAME_STATES[gameState] || GAME_STATES.BETTING_OPEN;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Game State Indicator */}
      <motion.div
        className="px-6 py-3 rounded-xl backdrop-blur-xl border"
        style={{
          background: CASINO_THEME.glass.background,
          borderColor: currentState.color + '40',
          boxShadow: `${CASINO_THEME.glass.shadow}, 0 0 20px ${currentState.color}40`
        }}
        animate={{
          boxShadow: [
            `${CASINO_THEME.glass.shadow}, 0 0 20px ${currentState.color}40`,
            `${CASINO_THEME.glass.shadow}, 0 0 40px ${currentState.color}80`,
            `${CASINO_THEME.glass.shadow}, 0 0 20px ${currentState.color}40`
          ]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      >
        <div className="text-center">
          <motion.div
            className="text-xl md:text-2xl font-black font-sans tracking-widest"
            style={{ color: currentState.color }}
            animate={{
              opacity: [0.7, 1, 0.7]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            {currentState.text}
          </motion.div>
          
          {/* Dealer Message */}
          <AnimatePresence mode="wait">
            {dealerMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="text-sm text-white/60 mt-1 font-sans tracking-wide"
              >
                {dealerMessage}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Controls Row */}
      <div className="flex gap-2 justify-center">
        {/* Sound Toggle */}
        {onToggleSound && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onToggleSound}
            className="px-4 py-2 rounded-lg backdrop-blur-xl border border-white/20 flex items-center gap-2"
            style={{
              background: CASINO_THEME.glass.background,
              boxShadow: CASINO_THEME.glass.shadow
            }}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-white/40" />
            )}
            <span className="text-sm text-white/80 font-semibold">
              {soundEnabled ? 'Sound On' : 'Sound Off'}
            </span>
          </motion.button>
        )}

        {/* Rules Button */}
        {onShowRules && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onShowRules}
            className="px-4 py-2 rounded-lg backdrop-blur-xl border border-white/20 flex items-center gap-2"
            style={{
              background: CASINO_THEME.glass.background,
              boxShadow: CASINO_THEME.glass.shadow
            }}
          >
            <Info className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white/80 font-semibold">Rules</span>
          </motion.button>
        )}
      </div>

      {/* Stats Display (optional) */}
      {stats && (
        <div 
          className="px-4 py-3 rounded-lg backdrop-blur-xl border border-white/10 grid grid-cols-3 gap-4"
          style={{
            background: CASINO_THEME.glass.background,
            boxShadow: CASINO_THEME.glass.shadow
          }}
        >
          <div className="text-center">
            <div className="text-xs text-white/40 font-semibold mb-1 tracking-widest">HANDS</div>
            <div className="text-lg font-bold text-cyan-400">{stats.handsPlayed || 0}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40 font-semibold mb-1 tracking-widest">WIN RATE</div>
            <div className="text-lg font-bold text-green-400">{stats.winRate || 0}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-white/40 font-semibold mb-1 tracking-widest">PROFIT</div>
            <div className={`text-lg font-bold ${(stats.profit || 0) >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
              ${Math.abs(stats.profit || 0)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
