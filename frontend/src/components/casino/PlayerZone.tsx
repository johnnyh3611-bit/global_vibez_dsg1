
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Timer, TrendingUp } from 'lucide-react';
import { CASINO_THEME, formatCurrency } from '@/utils/casinoTheme';
import PlayingCard3D from './PlayingCard3D';

// Individual player seating area with turn indicator, timer, cards, and stats
// Positioned clockwise around the table

export default function PlayerZone({
  playerId,
  position = 'bottom', // 'bottom', 'top', 'left', 'right'
  playerName = 'Player',
  isActive = false,
  cards = [],
  chips = 1000,
  timer = null,
  avatar = null,
  stats = null,
  className = ''
}) {
  const positionConfig = CASINO_THEME.playerZone.positions[playerId] || CASINO_THEME.playerZone.positions[1];
  const zoneColor = positionConfig.color;

  // Card fanning angles based on card count
  const getCardRotation = (index, totalCards) => {
    if (totalCards === 1) return 0;
    const spreadAngle = Math.min(totalCards * 5, 30); // Max 30° spread
    const step = spreadAngle / (totalCards - 1);
    return (index - (totalCards - 1) / 2) * step;
  };

  const getCardOffset = (index, totalCards) => {
    if (totalCards === 1) return 0;
    const spreadOffset = Math.min(totalCards * 2, 15); // Max 15px spread
    const step = spreadOffset / (totalCards - 1);
    return (index - (totalCards - 1) / 2) * step;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`relative ${className}`}
      style={{
        width: `${CASINO_THEME.playerZone.width}px`,
        height: `${CASINO_THEME.playerZone.height}px`
      }}
    >
      {/* Active Turn Indicator */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="absolute -inset-2 rounded-2xl pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${zoneColor}40, transparent)`,
              border: `3px solid ${zoneColor}`,
              boxShadow: `0 0 30px ${zoneColor}80, inset 0 0 20px ${zoneColor}40`
            }}
          >
            {/* Pulsing glow animation */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              animate={{
                boxShadow: [
                  `0 0 20px ${zoneColor}60`,
                  `0 0 40px ${zoneColor}`,
                  `0 0 20px ${zoneColor}60`
                ]
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player Info Panel */}
      <div 
        className="relative z-10 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl p-3 h-full flex flex-col"
        style={{
          boxShadow: CASINO_THEME.glass.shadow
        }}
      >
        {/* Header: Avatar + Name + Timer */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {avatar ? (
              <img src={avatar} alt={playerName} className="w-10 h-10 rounded-full border-2" style={{ borderColor: zoneColor }} />
            ) : (
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center border-2"
                style={{ 
                  borderColor: zoneColor,
                  background: `linear-gradient(135deg, ${zoneColor}40, transparent)`
                }}
              >
                <Users className="w-5 h-5" style={{ color: zoneColor }} />
              </div>
            )}
            <div>
              <div className="text-white font-bold text-sm">{playerName}</div>
              <div className="text-xs" style={{ color: zoneColor }}>{formatCurrency(chips)}</div>
            </div>
          </div>

          {/* Timer (if active) */}
          {isActive && timer !== null && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{
                background: timer < 10 ? '#FF003C20' : `${zoneColor}20`,
                border: `1px solid ${timer < 10 ? '#FF003C' : zoneColor}`
              }}
            >
              <Timer className="w-3 h-3" style={{ color: timer < 10 ? '#FF003C' : zoneColor }} />
              <span className="text-xs font-bold" style={{ color: timer < 10 ? '#FF003C' : zoneColor }}>
                {timer}s
              </span>
            </motion.div>
          )}
        </div>

        {/* Card Hand Display (Fanned) */}
        <div className="flex-1 flex items-center justify-center relative">
          <div className="relative" style={{ width: '100%', height: '90px' }}>
            <AnimatePresence mode="popLayout">
              {cards.map((card, index) => (
                <motion.div
                  key={`${card.suit}-${card.value}-${index}`}
                  initial={{ 
                    x: 0, 
                    y: -100, 
                    opacity: 0,
                    rotate: 0,
                    scale: 0.5
                  }}
                  animate={{ 
                    x: getCardOffset(index, cards.length),
                    y: 0,
                    opacity: 1,
                    rotate: getCardRotation(index, cards.length),
                    scale: 1
                  }}
                  exit={{
                    y: -100,
                    opacity: 0,
                    scale: 0.5
                  }}
                  transition={{ 
                    duration: 0.6,
                    delay: index * 0.1,
                    ease: CASINO_THEME.timing.easeOut as any
                  }}
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ zIndex: index }}
                >
                  <PlayingCard3D
                    value={card.value}
                    suit={card.suit}
                    faceUp={card.faceUp !== false}
                    animate={false}
                    size="small"
                    glow={isActive}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Empty state */}
            {cards.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white/30 text-xs font-semibold tracking-wider">NO CARDS</div>
              </div>
            )}
          </div>
        </div>

        {/* Stats (optional) */}
        {stats && (
          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-white/60">
              <TrendingUp className="w-3 h-3" />
              <span>Wins: {stats.wins || 0}</span>
            </div>
            <div className="text-white/60">
              Streak: {stats.streak || 0}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
