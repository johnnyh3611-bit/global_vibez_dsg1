import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * 2D Top-Down Game Table (Mobile-style view)
 * Based on reference: Green felt table with players positioned around it
 */

// Theme configurations for different professional casino looks
const TABLE_THEMES = {
  classic_green: {
    name: 'Classic Green Casino',
    tableBg: 'bg-gradient-to-br from-green-800 via-green-900 to-green-800',
    tableBorder: 'border-[#5C4033] shadow-[0_0_60px_rgba(92,64,51,0.8)]', // Dark wood
    outerBg: 'bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950',
    railColor: 'from-amber-900 to-amber-950',
  },
  luxury_purple: {
    name: 'Luxury Purple Royal',
    tableBg: 'bg-gradient-to-br from-purple-900 via-purple-950 to-purple-900',
    tableBorder: 'border-yellow-600 shadow-[0_0_60px_rgba(202,138,4,0.8)]', // Gold
    outerBg: 'bg-gradient-to-br from-purple-950 via-gray-900 to-purple-950',
    railColor: 'from-yellow-700 to-yellow-900',
  },
  modern_black: {
    name: 'Modern Black Carbon',
    tableBg: 'bg-gradient-to-br from-gray-900 via-black to-gray-900',
    tableBorder: 'border-gray-400 shadow-[0_0_60px_rgba(156,163,175,0.8)]', // Chrome
    outerBg: 'bg-gradient-to-br from-slate-950 via-gray-950 to-slate-950',
    railColor: 'from-gray-600 to-gray-800',
  },
  classic_red: {
    name: 'Classic Red Poker Room',
    tableBg: 'bg-gradient-to-br from-red-900 via-red-950 to-red-900',
    tableBorder: 'border-amber-800 shadow-[0_0_60px_rgba(146,64,14,0.8)]', // Leather brown
    outerBg: 'bg-gradient-to-br from-red-950 via-stone-900 to-red-950',
    railColor: 'from-amber-800 to-amber-950',
  },
  blue_ocean: {
    name: 'Blue Ocean Premium',
    tableBg: 'bg-gradient-to-br from-blue-900 via-blue-950 to-blue-900',
    tableBorder: 'border-cyan-700 shadow-[0_0_60px_rgba(14,116,144,0.8)]', // Ocean blue
    outerBg: 'bg-gradient-to-br from-blue-950 via-gray-900 to-blue-950',
    railColor: 'from-cyan-800 to-cyan-950',
  },
};

export function TopDownGameTable({ 
  children,
  playerHand = [],
  playerAvatar = null,
  playerName = 'You',
  opponentPositions = [], // Array of {avatar, cardCount, position: 'top'|'left'|'right'}
  centerCards = [],
  scoreInfo = null,
  onCardClick,
  theme = 'classic_green', // NEW: Theme selector
}: {
  children?: any;
  playerHand?: any[];
  playerAvatar?: any;
  playerName?: string;
  opponentPositions?: any[];
  centerCards?: any[];
  scoreInfo?: any;
  onCardClick?: any;
  theme?: string;
}) {
  
  // Get current theme configuration
  const currentTheme = (TABLE_THEMES as Record<string, any>)[theme] || TABLE_THEMES.classic_green;
  
  return (
    <div className={`relative w-full h-screen ${currentTheme.outerBg} overflow-hidden`}>
      
      {/* Top UI Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4">
        {/* Left Side - Actions */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg border-2 border-white/20"
          >
            <span className="text-2xl">🎴</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl font-black text-white shadow-lg border-2 border-white/20 flex items-center gap-2"
          >
            <span className="text-xl">💰</span>
            <span>Buy Coins</span>
          </motion.button>
        </div>

        {/* Right Side - Score & Menu */}
        <div className="flex items-center gap-3">
          {scoreInfo && (
            <div className="bg-black/80 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-cyan-500/50 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-400 rounded-full" />
                <span className="text-white font-bold">{scoreInfo.blue || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-400 rounded-full" />
                <span className="text-white font-bold">{scoreInfo.red || 0}</span>
              </div>
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-2xl flex items-center justify-center shadow-lg border-2 border-white/20"
          >
            <span className="text-2xl">💬</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl flex items-center justify-center shadow-lg border-2 border-white/20"
          >
            <span className="text-2xl">☰</span>
          </motion.button>
        </div>
      </div>

      {/* Main Game Table */}
      <div className="absolute inset-0 flex items-center justify-center p-8 pt-24 pb-32">
        <div className="relative w-full max-w-6xl aspect-[16/10]">
          
          {/* Gold Frame */}
          <div 
            className="absolute inset-0 rounded-[3rem] shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #D4AF37 0%, #F4E5B8 50%, #D4AF37 100%)',
              padding: '8px',
            }}
          >
            {/* Brown Wooden Rail */}
            <div 
              className="absolute inset-0 rounded-[2.8rem]"
              style={{
                background: 'linear-gradient(135deg, #5C3D2E 0%, #8B4513 50%, #5C3D2E 100%)',
                padding: '20px',
              }}
            >
              {/* Table Felt Surface */}
              <div 
                className={`absolute inset-0 rounded-[2.5rem] relative overflow-hidden ${currentTheme.tableBg}`}
                style={{
                  boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.4)',
                }}
              >
                {/* Felt Texture */}
                <div 
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
                  }}
                />

                {/* Top Opponent */}
                {opponentPositions.find(p => p.position === 'top') && (
                  <div className="absolute top-6 left-1/2 transform -translate-x-1/2">
                    <OpponentAvatar 
                      {...opponentPositions.find(p => p.position === 'top')} 
                      color="blue"
                    />
                  </div>
                )}

                {/* Left Opponent */}
                {opponentPositions.find(p => p.position === 'left') && (
                  <div className="absolute left-8 top-1/2 transform -translate-y-1/2">
                    <OpponentAvatar 
                      {...opponentPositions.find(p => p.position === 'left')} 
                      color="red"
                    />
                  </div>
                )}

                {/* Right Opponent */}
                {opponentPositions.find(p => p.position === 'right') && (
                  <div className="absolute right-8 top-1/2 transform -translate-y-1/2">
                    <OpponentAvatar 
                      {...opponentPositions.find(p => p.position === 'right')} 
                      color="green"
                    />
                  </div>
                )}

                {/* Center Cards */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="flex gap-2">
                    {centerCards.map((card, i) => (
                      <motion.div
                        key={card.id || `centerCards-${i}`}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: card.rotation || 0 }}
                        className="w-20 h-28 bg-white rounded-lg shadow-2xl flex items-center justify-center"
                      >
                        <div className="text-center">
                          <p className="text-3xl">{card.suit}</p>
                          <p className="text-2xl font-black">{card.rank}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Score/Info Text */}
                {scoreInfo?.text && (
                  <div className="absolute top-1/4 left-8">
                    <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                      <p className="text-white text-sm font-bold">{scoreInfo.text}</p>
                    </div>
                  </div>
                )}

                {/* Custom Children */}
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Player Hand */}
      <div className="absolute bottom-0 left-0 right-0 z-20 overflow-visible" style={{ paddingBottom: '20px' }}>
        <div className="relative flex items-end justify-center overflow-visible">
          {/* Card Fan */}
          <div className="relative overflow-visible flex items-end justify-center" style={{ width: '85%', maxWidth: '900px', height: '180px', marginBottom: '20px' }}>
            {playerHand.map((card, i) => {
              const totalCards = playerHand.length;
              const centerIndex = (totalCards - 1) / 2;
              const offset = i - centerIndex;
              
              // Improved arc calculations
              const rotation = offset * 3.5; // Tighter rotation
              const xPos = 50 + (offset * 8); // Percentage-based positioning
              const yOffset = Math.abs(offset) * 6; // Subtle arc

              return (
                <motion.div
                  key={card.id || i}
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ 
                    y: 0, 
                    opacity: 1,
                  }}
                  whileHover={{ 
                    y: -35, 
                    scale: 1.15,
                    rotate: 0,
                    zIndex: 100,
                  }}
                  transition={{ 
                    delay: i * 0.03,
                    type: 'spring',
                    stiffness: 300,
                  }}
                  onClick={() => onCardClick && onCardClick(card, i)}
                  className="absolute cursor-pointer"
                  style={{
                    left: `${xPos}%`,
                    bottom: `${yOffset}px`,
                    transform: `translateX(-50%) rotate(${rotation}deg)`,
                    transformOrigin: 'bottom center',
                    zIndex: 10 + i,
                  }}
                >
                  {/* Card with border glow */}
                  <div className="relative">
                    {/* Glow effect */}
                    <div className="absolute inset-0 bg-purple-500 rounded-xl blur-sm opacity-0 hover:opacity-50 transition-opacity" />
                    
                    {/* Card */}
                    <div className="relative w-24 h-36 bg-white rounded-xl shadow-2xl border-[3px] border-purple-500 flex flex-col items-center justify-center">
                      <p className="text-5xl mb-1">{card.suit}</p>
                      <p className="text-3xl font-black text-gray-800">{card.rank}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Center Action Button - "J" with card count */}
            {playerHand.length > 0 && (
              <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-[5]">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: playerHand.length * 0.03 + 0.2, type: 'spring' }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative cursor-pointer"
                >
                  {/* Button glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-2xl blur-lg opacity-60" />
                  
                  {/* Button */}
                  <div className="relative w-20 h-20 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-2xl shadow-2xl border-[3px] border-white flex items-center justify-center">
                    <p className="text-4xl font-black text-white drop-shadow-lg">J</p>
                  </div>
                  
                  {/* Card count badge */}
                  <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-blue-600 px-3 py-1 rounded-full border-2 border-white shadow-lg">
                    <p className="text-white text-xs font-black">0/{playerHand.length}</p>
                  </div>
                </motion.div>
              </div>
            )}
            
            {/* Player Avatar (Bottom) */}
            {playerAvatar && (
              <div className="absolute -bottom-12 left-1/2 transform -translate-x-1/2 z-[90]">
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col items-center"
                >
                  {/* Avatar oval frame */}
                  <div className="w-16 h-22 bg-gradient-to-br from-fuchsia-400 to-purple-400 rounded-[1.5rem] p-[2px] shadow-2xl shadow-fuchsia-500/50">
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-[1.4rem] overflow-hidden flex items-center justify-center">
                      {typeof playerAvatar === 'object' && playerAvatar.emoji ? (
                        <span className="text-3xl">{playerAvatar.emoji}</span>
                      ) : typeof playerAvatar === 'string' ? (
                        <span className="text-3xl">{playerAvatar}</span>
                      ) : (
                        <span className="text-2xl">👤</span>
                      )}
                    </div>
                  </div>
                  {/* Player name */}
                  <p className="text-white text-xs font-bold mt-1 bg-black/50 px-3 py-1 rounded-lg">
                    {playerName}
                  </p>
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Opponent Avatar Component
function OpponentAvatar({ avatar, cardCount = 0, color = 'blue', name = 'Player' }: { avatar?: any, cardCount?: any, color?: any, name?: any }) {
  const colorMap = {
    blue: {
      border: 'from-blue-400 to-cyan-400',
      badge: 'bg-blue-600',
      glow: 'shadow-blue-500/50'
    },
    red: {
      border: 'from-red-400 to-rose-400',
      badge: 'bg-red-600',
      glow: 'shadow-red-500/50'
    },
    green: {
      border: 'from-green-400 to-emerald-400',
      badge: 'bg-green-600',
      glow: 'shadow-green-500/50'
    },
  };

  const colors = colorMap[color] || colorMap.blue;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {/* Oval Avatar Frame with colored border */}
        <div className={`w-20 h-28 bg-gradient-to-br ${colors.border} rounded-[2rem] p-[3px] ${colors.glow} shadow-2xl`}>
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-[1.8rem] overflow-hidden flex items-center justify-center">
            {avatar ? (
              // If avatar is an object with emoji
              typeof avatar === 'object' && avatar.emoji ? (
                <div className="text-center">
                  <span className="text-5xl">{avatar.emoji}</span>
                </div>
              ) : typeof avatar === 'string' && avatar.startsWith('http') ? (
                // If avatar is an image URL
                <img src={avatar} alt={name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                // If avatar is just an emoji string
                <div className="text-center">
                  <span className="text-5xl">{avatar}</span>
                </div>
              )
            ) : (
              <div className="text-center">
                <span className="text-4xl">👤</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Card Count Badge at bottom */}
        <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 ${colors.badge} px-3 py-1 rounded-lg border-2 border-white shadow-lg z-10`}>
          <p className="text-white text-xs font-black">{cardCount}/2</p>
        </div>

        {/* Small info icon */}
        <div className={`absolute -bottom-2 -right-1 w-7 h-7 ${colors.badge} rounded-lg border-2 border-white flex items-center justify-center shadow-lg`}>
          <span className="text-white text-[10px] font-bold">ℹ️</span>
        </div>
      </div>
      
      {/* Player Name */}
      {name && (
        <div className="mt-1">
          <p className="text-white text-xs font-bold text-center px-2 py-1 bg-black/50 rounded-lg">
            {name}
          </p>
        </div>
      )}
    </div>
  );
}
