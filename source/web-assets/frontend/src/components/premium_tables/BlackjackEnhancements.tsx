import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * BLACKJACK ENHANCEMENTS - AAA Quality Features
 * Based on Wild Casino, BetWhale, FanDuel benchmarks
 */

// Shuffle Animation (deck spreading)
export function ShuffleAnimation({ trigger, onComplete }: { trigger?: any, onComplete?: any }) {
  if (!trigger) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 pointer-events-none">
      <div className="relative w-64 h-40">
        {[...Array(7)].map((_, i) => (
          <motion.div
            key={_.id || _.name || `item-${i}`}
            initial={{ 
              x: 0, 
              y: 0, 
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              x: (i - 3) * 30,
              y: Math.abs(i - 3) * -20,
              rotate: (i - 3) * 10,
              opacity: [1, 1, 0],
            }}
            transition={{
              duration: 1.5,
              delay: i * 0.1,
              ease: 'easeInOut',
            }}
            onAnimationComplete={i === 6 ? onComplete : undefined}
            className="absolute left-1/2 top-1/2 w-20 h-28 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border-2 border-pink-500 flex items-center justify-center"
            style={{ transform: 'translate(-50%, -50%)' }}
          >
            <span className="text-pink-400 text-xs font-bold">SHUFFLE</span>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2"
        >
          <p className="text-white text-2xl font-black">🎰 SHUFFLING...</p>
        </motion.div>
      </div>
    </div>
  );
}

// Dealer Reveal Animation (suspenseful flip)
export function DealerRevealAnimation({ card, onComplete }: { card?: any, onComplete?: any }) {
  return (
    <motion.div
      initial={{ rotateY: 180 }}
      animate={{ rotateY: 0 }}
      transition={{
        duration: 1.2,
        ease: [0.43, 0.13, 0.23, 0.96],
        delay: 0.5,
      }}
      onAnimationComplete={onComplete}
      style={{ transformStyle: 'preserve-3d' }}
      className="relative"
    >
      {card}
      
      {/* Glow effect during reveal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.2 }}
        className="absolute inset-0 rounded-xl"
        style={{
          boxShadow: '0 0 40px rgba(212, 175, 55, 0.8)',
          pointerEvents: 'none',
        }}
      />
    </motion.div>
  );
}

// Win Rate Stats Display
export function BlackjackStatsOverlay({ stats, visible = false }: { stats?: any, visible?: any }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-20 right-4 z-30"
    >
      <div className="bg-black/90 backdrop-blur-xl p-4 rounded-xl border-2 border-rose-500/50 min-w-[220px]">
        <p className="text-rose-400 font-black text-sm mb-3 flex items-center gap-2">
          🎰 BLACKJACK STATS
        </p>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Hands Played:</span>
            <span className="text-white font-bold">{stats.handsPlayed || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Win Rate:</span>
            <span className="text-green-400 font-bold">{stats.winRate || 0}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Blackjacks:</span>
            <span className="text-yellow-400 font-bold">{stats.blackjacks || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Total Won:</span>
            <span className="text-green-400 font-bold">${stats.totalWon || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Biggest Win:</span>
            <span className="text-purple-400 font-bold">${stats.biggestWin || 0}</span>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-xs">🏆 Streak:</span>
            <span className="text-yellow-400 text-sm font-bold">{stats.streak || 0} wins</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Card Burn Animation (dealer burns top card)
export function CardBurnAnimation({ trigger }: { trigger?: any }) {
  if (!trigger) return null;

  return (
    <motion.div
      initial={{ 
        opacity: 1, 
        scale: 1,
        x: 0,
        y: 0,
      }}
      animate={{
        opacity: 0,
        scale: 0.5,
        x: 200,
        y: -100,
        rotate: 360,
      }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="fixed left-1/2 top-1/2 w-20 h-28 bg-gradient-to-br from-orange-600 to-red-600 rounded-lg border-2 border-yellow-400 flex items-center justify-center z-50"
    >
      <span className="text-white text-2xl">🔥</span>
    </motion.div>
  );
}

// Enhanced Bust/Blackjack Celebration
export function BlackjackCelebration({ type = 'blackjack' }: { type?: any }) {
  if (!type) return null;

  const isBlackjack = type === 'blackjack';
  const isBust = type === 'bust';

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      {isBlackjack && (
        <>
          {/* Blackjack explosion effect */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={_.id || _.name || `item-${i}`}
              initial={{ 
                x: 0, 
                y: 0, 
                scale: 0,
                opacity: 1,
              }}
              animate={{
                x: Math.cos((i * Math.PI * 2) / 12) * 300,
                y: Math.sin((i * Math.PI * 2) / 12) * 300,
                scale: 1.5,
                opacity: 0,
              }}
              transition={{ 
                duration: 1.5, 
                delay: i * 0.05,
                ease: 'easeOut',
              }}
              className="absolute text-6xl"
            >
              ⭐
            </motion.div>
          ))}
          
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-9xl"
          >
            🎰
          </motion.div>
        </>
      )}
      
      {isBust && (
        <>
          {/* Bust shake effect */}
          <motion.div
            animate={{ 
              x: [-20, 20, -20, 20, 0],
              rotate: [-5, 5, -5, 5, 0],
            }}
            transition={{ duration: 0.5 }}
            className="text-9xl"
          >
            💥
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

// Animated Dealer Avatar
export function DealerAvatar({ mood = 'neutral' }: { mood?: any }) {
  const moods = {
    neutral: { emoji: '😐', color: '#94A3B8' },
    happy: { emoji: '😊', color: '#22C55E' },
    sad: { emoji: '😔', color: '#EF4444' },
    surprised: { emoji: '😲', color: '#F59E0B' },
  };

  const { emoji, color } = moods[mood];

  return (
    <motion.div
      animate={{ 
        scale: [1, 1.05, 1],
      }}
      transition={{ duration: 2, repeat: Infinity }}
      className="flex flex-col items-center"
    >
      <motion.div
        className="w-24 h-24 rounded-full flex items-center justify-center mb-2"
        style={{
          background: `radial-gradient(circle, ${color}40 0%, ${color}20 100%)`,
          border: `3px solid ${color}`,
        }}
      >
        <span className="text-6xl">{emoji}</span>
      </motion.div>
      <div className="bg-black/80 px-4 py-2 rounded-full border border-white/20">
        <p className="text-white text-sm font-bold">🎩 DEALER</p>
      </div>
    </motion.div>
  );
}

// Insurance Offer Modal
export function InsuranceOffer({ visible, onAccept, onDecline }: { visible?: any, onAccept?: any, onDecline?: any }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className="bg-gradient-to-br from-blue-900 to-purple-900 p-8 rounded-2xl border-4 border-blue-400 shadow-2xl max-w-md"
      >
        <div className="text-center">
          <div className="text-6xl mb-4">🛡️</div>
          <h3 className="text-3xl font-black text-white mb-4">INSURANCE?</h3>
          <p className="text-white/80 text-sm mb-2">
            Dealer shows an ACE!
          </p>
          <p className="text-white/60 text-xs mb-6">
            Insurance costs 50% of your bet. Pays 2:1 if dealer has Blackjack.
          </p>
          
          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAccept}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white font-black py-4 rounded-xl text-lg"
            >
              ✅ BUY
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDecline}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white font-black py-4 rounded-xl text-lg"
            >
              ❌ NO
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Chip Stack Physics Animation
export function AnimatedChipStacks({ betAmount, position }: { betAmount?: any, position?: any }) {
  const stacks = Math.floor(betAmount / 100);
  const remainder = betAmount % 100;

  return (
    <div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Full stacks of 100 */}
      {[...Array(stacks)].map((_, stackIdx) => (
        <div key={stackIdx} className="absolute" style={{ left: stackIdx * 20 }}>
          {[...Array(5)].map((_, chipIdx) => (
            <motion.div
              key={chipIdx}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: -chipIdx * 6, opacity: 1 }}
              transition={{ 
                delay: stackIdx * 0.1 + chipIdx * 0.05,
                type: 'spring',
                stiffness: 200,
              }}
              className="absolute w-10 h-3 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
                border: '2px solid #FCA5A5',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                bottom: 0,
              }}
            />
          ))}
        </div>
      ))}
      
      {/* Remainder chips */}
      {remainder > 0 && (
        <div className="absolute" style={{ left: stacks * 20 }}>
          {[...Array(Math.ceil(remainder / 25))].map((_, i) => (
            <motion.div
              key={_.id || _.name || `item-${i}`}
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: -i * 6, opacity: 1 }}
              transition={{ 
                delay: stacks * 0.1 + i * 0.05,
                type: 'spring',
              }}
              className="absolute w-10 h-3 rounded-full"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%)',
                border: '2px solid #93C5FD',
                bottom: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
