import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '@/components/BackButton';

/**
 * Premium Casino Card Game Layout Template
 * Reusable AAA visual wrapper for all casino card games
 */
interface PremiumCasinoCardLayoutProps {
  credits?: any;
  currentBet?: any;
  gameState?: any;
  winner?: any;
  dealerCards?: any[];
  playerCards?: any[];
  dealerLabel?: string;
  playerLabel?: string;
  themeColor?: string;
  gameTitle?: string;
  chipValue?: any;
  onChipSelect?: (v: number) => void;
  chipValues?: number[];
  children?: React.ReactNode;
  extraInfo?: React.ReactNode;
}

export default function PremiumCasinoCardLayout({
  credits,
  currentBet,
  gameState,
  winner,
  dealerCards = [],
  playerCards = [],
  dealerLabel = '🎩 DEALER',
  playerLabel = '💎 PLAYER',
  themeColor = 'purple',
  gameTitle = 'CASINO CARD GAME',
  chipValue,
  onChipSelect,
  chipValues = [25, 100, 500, 1000],
  children,
  extraInfo,
}: PremiumCasinoCardLayoutProps) {
  const themeColors = {
    purple: {
      primary: 'from-purple-500/20 to-pink-500/20',
      border: 'border-purple-400',
      shadow: 'rgba(157,78,221,0.3)',
      text: 'from-purple-400 to-pink-400',
      particle: 'bg-purple-400',
      dealer: 'border-purple-400',
      player: 'border-cyan-400',
      dealerGlow: 'from-purple-400/10',
      playerGlow: 'from-cyan-400/10'
    },
    red: {
      primary: 'from-red-500/20 to-orange-500/20',
      border: 'border-red-400',
      shadow: 'rgba(255,0,0,0.3)',
      text: 'from-red-400 to-orange-400',
      particle: 'bg-red-400',
      dealer: 'border-red-400',
      player: 'border-blue-400',
      dealerGlow: 'from-red-400/10',
      playerGlow: 'from-blue-400/10'
    },
    cyan: {
      primary: 'from-cyan-500/20 to-blue-500/20',
      border: 'border-cyan-400',
      shadow: 'rgba(0,240,255,0.3)',
      text: 'from-cyan-400 to-blue-400',
      particle: 'bg-cyan-400',
      dealer: 'border-yellow-400',
      player: 'border-cyan-400',
      dealerGlow: 'from-yellow-400/10',
      playerGlow: 'from-cyan-400/10'
    },
    yellow: {
      primary: 'from-yellow-500/20 to-orange-500/20',
      border: 'border-yellow-400',
      shadow: 'rgba(255,215,0,0.3)',
      text: 'from-yellow-400 to-orange-400',
      particle: 'bg-yellow-400',
      dealer: 'border-yellow-400',
      player: 'border-cyan-400',
      dealerGlow: 'from-yellow-400/10',
      playerGlow: 'from-cyan-400/10'
    }
  };

  const theme = themeColors[themeColor] || themeColors.purple;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: 'radial-gradient(ellipse at center, #1a0033 0%, #0a0015 50%, #000000 100%)'
    }}>
      <BackButton to="/games" label="Back to Games" variant="casino" />

      {/* Animated Background Particles */}
      <div className="absolute inset-0 opacity-20">
        {[...Array(100)].map((_, i) => (
          <motion.div
            key={_.id || _.name || `item-${i}`}
            className={`absolute w-1 h-1 ${theme.particle} rounded-full`}
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 1, 0.2],
              scale: [1, 1.5, 1]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
          />
        ))}
      </div>

      {/* Top Premium HUD */}
      <div className="absolute top-2 left-0 right-0 z-50">
        <div className="flex justify-center gap-4">
          <motion.div 
            className={`bg-gradient-to-br ${theme.primary} backdrop-blur-2xl ${theme.border} rounded-xl px-4 py-2 shadow-[0_0_30px_${theme.shadow}]`}
            whileHover={{ scale: 1.05 }}
          >
            <div className="text-[10px] text-white/70 mb-0.5 tracking-wider font-bold">💰 CREDITS</div>
            <div className={`text-lg font-black text-transparent bg-clip-text bg-gradient-to-r ${theme.text}`}>
              ${credits.toLocaleString()}
            </div>
          </motion.div>

          <motion.div 
            className={`bg-gradient-to-br ${theme.primary} backdrop-blur-2xl ${theme.border} rounded-xl px-4 py-2 shadow-[0_0_30px_${theme.shadow}]`}
            whileHover={{ scale: 1.05 }}
          >
            <div className="text-[10px] text-white/70 mb-0.5 tracking-wider font-bold">BET</div>
            <div className={`text-lg font-black text-transparent bg-clip-text bg-gradient-to-r ${theme.text}`}>
              ${currentBet.toLocaleString()}
            </div>
          </motion.div>
        </div>

        <motion.div className="text-center mt-2">
          <div className={`inline-block bg-gradient-to-r ${theme.primary} backdrop-blur-xl ${theme.border} rounded-full px-6 py-1.5 shadow-[0_0_40px_${theme.shadow}]`}>
            <div className={`text-sm font-black text-transparent bg-clip-text bg-gradient-to-r ${theme.text} tracking-widest`}>
              {gameState}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Green Felt Table with Cards */}
      <div className="absolute top-[85px] left-1/2 transform -translate-x-1/2 z-30" style={{ perspective: '2000px' }}>
        
        <div className="relative mx-auto" style={{ width: '900px', height: '420px' }}>
          {/* Green Felt */}
          <div 
            className="absolute inset-0 rounded-[50%] shadow-[0_30px_80px_rgba(0,0,0,0.8),inset_0_0_100px_rgba(0,100,0,0.3)]"
            style={{
              background: 'radial-gradient(ellipse at center, #2d5016 0%, #1a3d0f 50%, #0d2108 100%)',
              border: '20px solid #8B4513',
              boxShadow: '0 30px 80px rgba(0,0,0,0.8), inset 0 0 100px rgba(0,100,0,0.3), inset 0 -10px 30px rgba(0,0,0,0.5)',
              zIndex: 1
            }}
          >
            {/* Dealer/Player zones */}
            <div className="absolute left-[8%] top-1/2 transform -translate-y-1/2 w-[38%] h-[65%] rounded-lg border-2 border-yellow-600/30 bg-yellow-600/5" />
            <div className="absolute right-[8%] top-1/2 transform -translate-y-1/2 w-[38%] h-[65%] rounded-lg border-2 border-cyan-600/30 bg-cyan-600/5" />
            <div className="absolute left-1/2 top-[15%] bottom-[15%] w-[2px] bg-white/10 transform -translate-x-1/2" />
          </div>

          {/* Cards Display */}
          <div className="absolute inset-0 grid grid-cols-2 gap-20 px-16" style={{ zIndex: 10, paddingTop: '80px', paddingBottom: '80px', maxHeight: '420px' }}>
            
            {/* Dealer Cards */}
            <div className="text-center">
              <motion.div 
                className="text-base font-black mb-2 tracking-widest"
                style={{ color: '#FFD700', textShadow: '0 0 15px #FFD700' }}
              >
                {dealerLabel}
              </motion.div>
              <div className="flex justify-center gap-2 flex-wrap">
                <AnimatePresence>
                  {dealerCards.map((card, i) => (
                    <motion.div
                      key={`dealer-${i}`}
                      initial={{ y: -80, opacity: 0, rotateX: 90 }}
                      animate={{ y: 0, opacity: 1, rotateX: 0 }}
                      transition={{ delay: i * 0.2, duration: 0.8, type: 'spring' }}
                      className={`w-20 h-28 bg-gradient-to-br from-white to-gray-100 rounded-lg border-3 ${theme.dealer} shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center relative overflow-hidden`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${theme.dealerGlow} to-transparent`} />
                      <div className={`text-3xl font-bold z-10 ${['hearts', 'diamonds'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>
                        {card.value}
                      </div>
                      <div className={`text-2xl z-10 ${['hearts', 'diamonds'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>
                        {card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* Player Cards */}
            <div className="text-center">
              <motion.div 
                className="text-base font-black mb-2 tracking-widest"
                style={{ color: '#00F0FF', textShadow: '0 0 15px #00F0FF' }}
              >
                {playerLabel}
              </motion.div>
              <div className="flex justify-center gap-2 flex-wrap">
                <AnimatePresence>
                  {playerCards.map((card, i) => (
                    <motion.div
                      key={`player-${i}`}
                      initial={{ y: 80, opacity: 0, rotateX: -90 }}
                      animate={{ y: 0, opacity: 1, rotateX: 0 }}
                      transition={{ delay: i * 0.2, duration: 0.8, type: 'spring' }}
                      className={`w-20 h-28 bg-gradient-to-br from-white to-gray-100 rounded-lg border-3 ${theme.player} shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center relative overflow-hidden`}
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${theme.playerGlow} to-transparent`} />
                      <div className={`text-3xl font-bold z-10 ${['hearts', 'diamonds'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>
                        {card.value}
                      </div>
                      <div className={`text-2xl z-10 ${['hearts', 'diamonds'].includes(card.suit) ? 'text-red-600' : 'text-black'}`}>
                        {card.suit === 'hearts' ? '♥' : card.suit === 'diamonds' ? '♦' : card.suit === 'clubs' ? '♣' : '♠'}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Extra Info (e.g., burned cards) */}
          {extraInfo && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              {extraInfo}
            </div>
          )}

          {/* Winner Announcement */}
          <AnimatePresence>
            {winner && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
              >
                <div className={`px-20 py-10 rounded-3xl border-6 shadow-[0_0_100px_rgba(255,215,0,0.8)] ${
                  winner.includes('PLAYER') ? 'bg-cyan-500/30 border-cyan-400' :
                  winner.includes('DEALER') ? 'bg-yellow-500/30 border-yellow-400' :
                  'bg-white/30 border-white'
                }`}>
                  <div className={`text-6xl font-black ${
                    winner.includes('PLAYER') ? 'text-cyan-300' :
                    winner.includes('DEALER') ? 'text-yellow-300' :
                    'text-white'
                  }`}>
                    🏆 {winner}!
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-4 left-0 right-0 z-50">
        <div className="max-w-6xl mx-auto px-4">
          
          {/* Custom Game Controls */}
          {children}

          {/* Chip Selector */}
          <div className="text-center mt-3">
            <div className="text-white/50 text-[10px] mb-1.5 tracking-[0.15em] font-bold">💰 CHIP VALUE</div>
            <div className="flex justify-center gap-3">
              {chipValues.map(value => (
                <motion.button
                  key={value}
                  onClick={() => onChipSelect && onChipSelect(value)}
                  className={`relative transition-all ${chipValue === value ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
                  whileHover={{ scale: chipValue === value ? 1.1 : 1.05, rotate: 360 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className={`w-11 h-11 rounded-full border-3 flex items-center justify-center font-bold text-white shadow-xl relative overflow-hidden ${
                    value === 25 ? 'bg-gradient-to-br from-blue-500 to-blue-700 border-blue-300' :
                    value === 100 ? 'bg-gradient-to-br from-purple-500 to-purple-700 border-purple-300' :
                    value === 500 ? 'bg-gradient-to-br from-yellow-500 to-yellow-700 border-yellow-300' :
                    'bg-gradient-to-br from-pink-500 to-pink-700 border-pink-300'
                  }`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
                    <span className="z-10 text-xs">${value}</span>
                  </div>
                  {chipValue === value && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      animate={{ boxShadow: [
                        '0 0 8px rgba(255,255,255,0.5)',
                        '0 0 16px rgba(255,255,255,1)',
                        '0 0 8px rgba(255,255,255,0.5)'
                      ]}}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
