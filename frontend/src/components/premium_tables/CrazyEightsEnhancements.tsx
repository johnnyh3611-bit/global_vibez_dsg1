import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CRAZY EIGHTS ENHANCEMENTS - AAA Quality Features
 * Based on top card game apps (2026)
 */

// Wild 8 Card Glow Effect
export function Wild8GlowEffect({ active = false }: { active?: any }) {
  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
    >
      {/* Rotating suit rings */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={_.id || _.name || `item-${i}`}
          animate={{
            rotate: 360,
            scale: [1, 1.2, 1],
          }}
          transition={{
            rotate: { duration: 4 - i * 0.5, repeat: Infinity, ease: 'linear' },
            scale: { duration: 2, repeat: Infinity },
          }}
          className="absolute rounded-full"
          style={{
            width: 200 + i * 100,
            height: 200 + i * 100,
            background: `conic-gradient(
              from ${i * 90}deg,
              #DC2626 0deg,
              #1F2937 90deg,
              #DC2626 180deg,
              #1F2937 270deg,
              #DC2626 360deg
            )`,
            opacity: 0.3 - i * 0.08,
            filter: 'blur(8px)',
          }}
        />
      ))}

      {/* Floating suits */}
      {['♠️', '♥️', '♣️', '♦️'].map((suit, i) => (
        <motion.div
          key={`item-${i}`}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 360],
          }}
          transition={{
            duration: 3,
            delay: i * 0.3,
            repeat: Infinity,
          }}
          className="absolute text-7xl"
          style={{
            left: `${25 + i * 16}%`,
            top: `${30 + (i % 2) * 40}%`,
            opacity: 0.6,
          }}
        >
          {suit}
        </motion.div>
      ))}

      {/* Center text */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{ duration: 1, repeat: Infinity }}
        className="text-9xl font-black text-white"
        style={{
          textShadow: '0 0 60px rgba(255, 255, 255, 0.8), 0 0 30px #DC2626',
        }}
      >
        CRAZY 8!
      </motion.div>
    </motion.div>
  );
}

// Suit Change Announcement
export function SuitChangeEffect({ suit, trigger, onComplete }: { suit?: any, trigger?: any, onComplete?: any }) {
  if (!trigger) return null;

  const suitData = {
    H: { icon: '♥️', name: 'HEARTS', color: '#DC2626' },
    D: { icon: '♦️', name: 'DIAMONDS', color: '#DC2626' },
    C: { icon: '♣️', name: 'CLUBS', color: '#1F2937' },
    S: { icon: '♠️', name: 'SPADES', color: '#1F2937' },
  };

  const data = suitData[suit] || suitData.H;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      onAnimationComplete={onComplete}
    >
      {/* Expanding circles */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={_.id || _.name || `item-${i}`}
          initial={{ scale: 0.5, opacity: 0.8 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{
            duration: 1.2,
            delay: i * 0.15,
            ease: 'easeOut',
          }}
          className="absolute rounded-full"
          style={{
            width: 300,
            height: 300,
            border: `8px solid ${data.color}`,
          }}
        />
      ))}

      {/* Suit icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
        className="text-9xl"
      >
        {data.icon}
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="absolute mt-48"
      >
        <p
          className="text-6xl font-black"
          style={{
            color: data.color,
            textShadow: '0 0 30px rgba(0,0,0,0.9)',
          }}
        >
          {data.name}!
        </p>
      </motion.div>
    </motion.div>
  );
}

// Draw Penalty Animation (when opponent draws cards)
export function DrawPenaltyAnimation({ count = 1, trigger, onComplete }: { count?: any, trigger?: any, onComplete?: any }) {
  if (!trigger) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Flying cards */}
      {[...Array(Math.min(count, 5))].map((_, i) => (
        <motion.div
          key={`item-${i}`}
          initial={{
            x: 0,
            y: 0,
            rotate: 0,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: Math.cos((i * Math.PI * 2) / count) * 250,
            y: Math.sin((i * Math.PI * 2) / count) * 250,
            rotate: Math.random() * 360,
            scale: 0.8,
            opacity: 0,
          }}
          transition={{
            duration: 1,
            delay: i * 0.08,
            ease: 'easeOut',
          }}
          onAnimationComplete={i === count - 1 ? onComplete : undefined}
          className="absolute w-20 h-28 rounded-lg bg-gradient-to-br from-red-600 to-rose-700 border-2 border-white shadow-2xl flex items-center justify-center"
        >
          <span className="text-white text-3xl font-black">+{count}</span>
        </motion.div>
      ))}

      {/* Center text */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="absolute"
      >
        <p className="text-7xl font-black text-red-500" style={{ textShadow: '0 0 20px rgba(0,0,0,0.8)' }}>
          DRAW {count}!
        </p>
      </motion.div>
    </div>
  );
}

// Multiplier/Combo Display
export function CrazyEightsMultiplier({ multiplier = 1, active = false }: { multiplier?: any, active?: any }) {
  if (!active || multiplier <= 1) return null;

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 180 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="fixed top-1/4 right-8 z-50"
    >
      <motion.div
        animate={{
          scale: [1, 1.12, 1],
          rotate: [0, 3, -3, 0],
        }}
        transition={{ duration: 0.6, repeat: Infinity }}
        className="relative"
      >
        {/* Glow */}
        <div
          className="absolute inset-0 rounded-2xl blur-2xl"
          style={{
            background: 'radial-gradient(circle, rgba(220, 38, 38, 0.8) 0%, transparent 70%)',
          }}
        />

        {/* Card */}
        <div className="relative bg-gradient-to-br from-red-500 via-rose-600 to-red-700 p-6 rounded-2xl border-4 border-white shadow-2xl">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center text-2xl border-4 border-white"
          >
            🔥
          </motion.div>

          <p className="text-white text-sm font-bold mb-2 text-center">COMBO!</p>
          <p className="text-8xl font-black text-white text-center" style={{ textShadow: '0 4px 8px rgba(0,0,0,0.4)' }}>
            ×{multiplier}
          </p>
          <p className="text-white text-xs text-center mt-2 font-bold">STREAK</p>
        </div>

        {/* Sparkles */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`item-${i}`}
            animate={{
              y: [0, -25, 0],
              x: [0, (i % 2 === 0 ? 8 : -8), 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.2,
              delay: i * 0.15,
              repeat: Infinity,
            }}
            className="absolute text-xl"
            style={{
              left: `${15 + i * 18}%`,
              top: '50%',
            }}
          >
            ✨
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// Last Card Warning (like UNO but for Crazy Eights)
export function LastCardWarning({ trigger, playerName = 'You' }: { trigger?: any, playerName?: any }) {
  if (!trigger) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
    >
      {/* Background flash */}
      <motion.div
        animate={{
          opacity: [0, 0.25, 0],
        }}
        transition={{ duration: 0.5, repeat: 2 }}
        className="absolute inset-0 bg-gradient-to-r from-red-600 via-orange-500 to-red-600"
      />

      {/* Pulsing rings */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={`item-${i}`}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 2, opacity: [0.8, 0] }}
          transition={{
            duration: 1.2,
            delay: i * 0.2,
            ease: 'easeOut',
          }}
          className="absolute rounded-full border-8 border-red-500"
          style={{
            width: 350,
            height: 350,
          }}
        />
      ))}

      {/* Warning text */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 180, delay: 0.2 }}
        className="relative"
      >
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            rotate: [0, 4, -4, 0],
          }}
          transition={{ duration: 0.5, repeat: 4 }}
          className="text-8xl font-black text-red-500"
          style={{
            textShadow: '0 0 40px rgba(220, 38, 38, 1), 0 0 20px #FFFFFF',
            WebkitTextStroke: '3px white',
          }}
        >
          LAST CARD!
        </motion.div>

        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-2xl font-bold text-white text-center mt-4"
          style={{ textShadow: '0 0 15px rgba(0,0,0,0.8)' }}
        >
          {playerName} is about to win!
        </motion.p>
      </motion.div>

      {/* Card icons flying */}
      {['♠️', '♥️', '♣️', '♦️'].map((suit, i) => (
        <motion.div
          key={`item-${i}`}
          initial={{
            x: 0,
            y: 0,
            scale: 0,
          }}
          animate={{
            x: Math.cos((i * Math.PI * 2) / 4) * 200,
            y: Math.sin((i * Math.PI * 2) / 4) * 200,
            scale: [0, 1.5, 1],
            rotate: Math.random() * 360,
          }}
          transition={{
            duration: 1,
            delay: i * 0.05,
            ease: 'easeOut',
          }}
          className="absolute text-5xl"
        >
          {suit}
        </motion.div>
      ))}
    </motion.div>
  );
}

// Victory Celebration
export function CrazyEightsVictory({ winner = 'You', trigger }: { winner?: any, trigger?: any }) {
  if (!trigger) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
    >
      {/* Playing card confetti */}
      {[...Array(40)].map((_, i) => {
        const suits = ['♠️', '♥️', '♣️', '♦️'];
        return (
          <motion.div
            key={_.id || _.name || `item-${i}`}
            initial={{
              x: window.innerWidth / 2,
              y: -50,
              rotate: 0,
            }}
            animate={{
              x: Math.random() * window.innerWidth,
              y: window.innerHeight + 100,
              rotate: Math.random() * 720,
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: i * 0.02,
              ease: 'linear',
            }}
            className="absolute text-4xl"
          >
            {suits[i % 4]}
          </motion.div>
        );
      })}

      {/* Trophy and text */}
      <div className="relative text-center">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 150, delay: 0.3 }}
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-9xl mb-6"
          >
            🏆
          </motion.div>

          <motion.h2
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-8xl font-black text-transparent bg-gradient-to-r from-red-500 via-orange-500 to-red-500 bg-clip-text mb-4"
            style={{
              WebkitTextStroke: '3px white',
              textShadow: '0 0 40px rgba(255, 255, 255, 0.5)',
            }}
          >
            WINNER!
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="text-3xl font-bold text-white mb-2"
          >
            🎉 {winner} cleared all cards! 🎉
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="text-xl text-red-400 font-bold"
          >
            ♠️ ♥️ ♣️ ♦️ CRAZY EIGHTS CHAMPION ♦️ ♣️ ♥️ ♠️
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            className="mt-8"
          >
            <p className="text-white/60 text-sm">Premium Tables | Global Vibez DSG</p>
          </motion.div>
        </motion.div>
      </div>

      {/* Sparkles */}
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={`item-${i}`}
          animate={{
            scale: [0, 1.5, 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 2,
            delay: i * 0.25,
            repeat: Infinity,
          }}
          className="absolute text-5xl"
          style={{
            left: `${5 + i * 9}%`,
            top: `${15 + (i % 2) * 70}%`,
          }}
        >
          ⭐
        </motion.div>
      ))}
    </motion.div>
  );
}

// Stats Overlay
export function CrazyEightsStatsOverlay({ stats, visible = false }: { stats?: any, visible?: any }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-20 right-4 z-30"
    >
      <div className="bg-black/90 backdrop-blur-xl p-4 rounded-xl border-2 border-red-500/50 min-w-[220px]">
        <p className="text-red-400 font-black text-sm mb-3 flex items-center gap-2">
          🎴 CRAZY 8s STATS
        </p>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Games Played:</span>
            <span className="text-white font-bold">{stats.gamesPlayed || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Win Rate:</span>
            <span className="text-green-400 font-bold">{stats.winRate || 0}%</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">8s Played:</span>
            <span className="text-purple-400 font-bold">{stats.eightsPlayed || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Perfect Wins:</span>
            <span className="text-yellow-400 font-bold">{stats.perfectWins || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Fastest Win:</span>
            <span className="text-cyan-400 font-bold">{stats.fastestWin || 0}s</span>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-white/40 text-xs">🔥 Best Streak:</span>
            <span className="text-orange-400 text-sm font-bold">{stats.bestStreak || 0} wins</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
