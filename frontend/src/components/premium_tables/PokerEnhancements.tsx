import React from 'react';
import { motion } from 'framer-motion';

/**
 * POKER ENHANCEMENTS - AAA Quality Features
 * Based on GGPoker, PokerStars benchmarks
 */

// Hand Strength Indicator (toggleable)
export function HandStrengthIndicator({ strength, visible = true }: { strength?: any, visible?: any }) {
  if (!visible) return null;

  const getStrength = () => {
    if (strength >= 90) return { label: 'MONSTER', color: '#22C55E', width: '100%' };
    if (strength >= 75) return { label: 'STRONG', color: '#3B82F6', width: '75%' };
    if (strength >= 50) return { label: 'DECENT', color: '#EAB308', width: '50%' };
    if (strength >= 25) return { label: 'WEAK', color: '#F97316', width: '25%' };
    return { label: 'TRASH', color: '#DC2626', width: '10%' };
  };

  const { label, color, width } = getStrength();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute"
      style={{
        left: '50%',
        bottom: '15%',
        transform: 'translateX(-50%)',
        zIndex: 100,
      }}
    >
      <div className="bg-black/80 backdrop-blur-xl px-6 py-3 rounded-xl border border-white/20">
        <p className="text-white/60 text-xs text-center mb-2">HAND STRENGTH</p>
        <div className="w-48 h-3 bg-white/10 rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: color }}
          />
        </div>
        <p className="text-center font-bold text-sm" style={{ color }}>
          {label}
        </p>
      </div>
    </motion.div>
  );
}

// All-In Equity Calculator (like GGPoker)
export function EquityCalculator({ playerEquity = 65, opponentEquity = 35, visible = false }: { playerEquity?: any, opponentEquity?: any, visible?: any }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 150,
      }}
    >
      <div className="bg-gradient-to-br from-purple-900/95 to-pink-900/95 backdrop-blur-xl p-6 rounded-2xl border-2 border-purple-400 shadow-2xl">
        <p className="text-white text-lg font-black text-center mb-4">⚡ ALL-IN EQUITY ⚡</p>
        
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <p className="text-cyan-400 text-sm font-bold mb-2">YOU</p>
            <div className="bg-black/40 rounded-full h-8 overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${playerEquity}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
              />
              <p className="absolute inset-0 flex items-center justify-center text-white font-black text-sm">
                {playerEquity}%
              </p>
            </div>
          </div>
          
          <div className="text-3xl">⚔️</div>
          
          <div className="flex-1">
            <p className="text-red-400 text-sm font-bold mb-2">OPP</p>
            <div className="bg-black/40 rounded-full h-8 overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${opponentEquity}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-red-500 to-rose-500"
              />
              <p className="absolute inset-0 flex items-center justify-center text-white font-black text-sm">
                {opponentEquity}%
              </p>
            </div>
          </div>
        </div>
        
        <p className="text-white/60 text-xs text-center">
          {playerEquity > opponentEquity ? '🎯 You\'re ahead!' : '⚠️ Behind, but not out!'}
        </p>
      </div>
    </motion.div>
  );
}

// Chip Stacking Animation (realistic physics)
export function AnimatedChipStack({ amount, position }: { amount?: any, position?: any }) {
  const chipCount = Math.min(Math.floor(amount / 10), 10);

  return (
    <div
      className="absolute"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {[...Array(chipCount)].map((_, i) => (
        <motion.div
          key={_.id || _.name || `item-${i}`}
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: -i * 4, opacity: 1 }}
          transition={{ delay: i * 0.05, type: 'spring', stiffness: 200 }}
          className="absolute w-12 h-3 rounded-full"
          style={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #F59E0B 100%)',
            border: '2px solid #92400E',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            bottom: 0,
          }}
        />
      ))}
    </div>
  );
}

// Dealer Button Glow
export function DealerButton({ position }: { position?: any }) {
  return (
    <motion.div
      animate={{
        boxShadow: [
          '0 0 20px rgba(212, 175, 55, 0.6)',
          '0 0 40px rgba(212, 175, 55, 0.9)',
          '0 0 20px rgba(212, 175, 55, 0.6)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity }}
      className="absolute w-12 h-12 rounded-full flex items-center justify-center"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        background: 'linear-gradient(135deg, #D4AF37 0%, #F59E0B 100%)',
        border: '3px solid white',
      }}
    >
      <span className="text-white text-sm font-black">D</span>
    </motion.div>
  );
}

// Felt Texture Overlay (realistic)
export function FeltTexture() {
  return (
    <div 
      className="absolute inset-0 pointer-events-none opacity-30"
      style={{
        backgroundImage: `
          repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px),
          repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)
        `,
        mixBlendMode: 'multiply',
      }}
    />
  );
}

// Pot Growth Animation (coins falling)
export function PotGrowthAnimation({ trigger }: { trigger?: any }) {
  if (!trigger) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 120 }}>
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={_.id || _.name || `item-${i}`}
          initial={{
            left: '50%',
            top: '30%',
            opacity: 1,
            scale: 1,
          }}
          animate={{
            left: `${50 + (Math.random() - 0.5) * 20}%`,
            top: `${50 + Math.random() * 20}%`,
            opacity: 0,
            scale: 0.5,
            rotate: Math.random() * 360,
          }}
          transition={{
            duration: 1,
            delay: i * 0.05,
            ease: 'easeOut',
          }}
          className="absolute w-8 h-8 rounded-full"
          style={{
            background: 'radial-gradient(circle, #FCD34D 0%, #D4AF37 100%)',
            boxShadow: '0 4px 12px rgba(212, 175, 55, 0.6)',
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-amber-900">
            $
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// Card Flip Enhanced (spring physics)
export function EnhancedCardFlip({ card, onFlipComplete }: { card?: any, onFlipComplete?: any }) {
  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0.8 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{
        rotateY: { type: 'spring', stiffness: 200, damping: 20 },
        scale: { duration: 0.3 },
      }}
      onAnimationComplete={onFlipComplete}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {card}
    </motion.div>
  );
}

// Statistics Overlay (win rate, games played)
export function StatsOverlay({ stats, visible = false }: { stats?: any, visible?: any }) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-20 right-4 z-30"
    >
      <div className="bg-black/80 backdrop-blur-xl p-4 rounded-xl border border-white/20 min-w-[200px]">
        <p className="text-white font-bold text-sm mb-3">📊 YOUR STATS</p>
        
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
            <span className="text-white/60">Total Winnings:</span>
            <span className="text-yellow-400 font-bold">${stats.totalWinnings || 0}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Biggest Pot:</span>
            <span className="text-purple-400 font-bold">${stats.biggestPot || 0}</span>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-white/40 text-xs">🏆 Rank: <span className="text-yellow-400">Gold II</span></p>
        </div>
      </div>
    </motion.div>
  );
}
