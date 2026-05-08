import React, { useState } from 'react';
import { motion } from 'framer-motion';
import HumanHolographicDealer from './HumanHolographicDealer';
import PlayingCard from './PlayingCard';
import { Volume2, VolumeX, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { CasinoTableLayoutCommonProps } from '@/types/casinoTableLayout';

/**
 * Enhanced Classic Casino Table Layout
 * Realistic perspective with dealer at top, player at bottom
 * Cards animate from dealer's position
 */

export default function ClassicCasinoTable({
  balance = 1000,
  currentBet = 0,
  dealerCards = [],
  playerCards = [],
  dealerScore = 0,
  playerScore = 0,
  dealerPhrase = 'welcome',
  dealerMood = 'professional',
  isDealing = false,
  isShuffling = false,
  isCelebrating = false,
  onHit,
  onStand,
  onDouble,
  onTipDealer,
  soundEnabled = true,
  onToggleSound,
  cardStyle = 'realistic',
  cardCount = 0,
  winStreak = 0,
  lossStreak = 0,
  gamePhase = 'betting',
  disabled = false,
  children,
  dealerType = 'nova'
}: {
  balance?: number;
  currentBet?: number;
  dealerCards?: any[];
  playerCards?: any[];
  dealerScore?: number;
  playerScore?: number;
  dealerPhrase?: string;
  dealerMood?: string;
  isDealing?: boolean;
  isShuffling?: boolean;
  isCelebrating?: boolean;
  onHit?: any;
  onStand?: any;
  onDouble?: any;
  onTipDealer?: any;
  soundEnabled?: boolean;
  onToggleSound?: any;
  cardStyle?: string;
  cardCount?: number;
  winStreak?: number;
  lossStreak?: number;
  gamePhase?: string;
  disabled?: boolean;
  children?: any;
  dealerType?: string;
}) {
  const [showStats, setShowStats] = useState(true);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-amber-900/20 via-yellow-900/20 to-amber-800/20 p-6">
      {/* Casino ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.05)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Top Stats Bar */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          {/* Left: Balance & Streak */}
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-gradient-to-r from-yellow-600 to-amber-700 px-6 py-3 rounded-2xl border-2 border-yellow-400 shadow-2xl"
            >
              <p className="text-yellow-200 text-xs font-bold">Balance</p>
              <p className="text-white text-3xl font-black">${balance.toLocaleString()}</p>
            </motion.div>
            
            {(winStreak > 0 || lossStreak > 0) && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`px-4 py-2 rounded-xl border-2 ${
                  winStreak > 0 
                    ? 'bg-green-900/40 border-green-500' 
                    : 'bg-red-900/40 border-red-500'
                }`}
              >
                {winStreak > 0 ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-green-400 inline mr-2" />
                    <span className="text-green-300 font-bold">{winStreak} Win Streak 🔥</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-5 h-5 text-red-400 inline mr-2" />
                    <span className="text-red-300 font-bold">{lossStreak} Loss Streak</span>
                  </>
                )}
              </motion.div>
            )}
          </div>
          
          {/* Right: Current Bet & Settings */}
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-3 rounded-2xl border-2 border-green-400 shadow-2xl"
            >
              <p className="text-green-200 text-xs font-bold">Current Bet</p>
              <p className="text-white text-3xl font-black">${currentBet}</p>
            </motion.div>
            
            <button
              onClick={onToggleSound}
              className="p-3 bg-gray-800 hover:bg-gray-700 rounded-xl border-2 border-gray-600 transition-all"
            >
              {soundEnabled ? (
                <Volume2 className="w-6 h-6 text-yellow-400" />
              ) : (
                <VolumeX className="w-6 h-6 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Table Container with CSS Grid Layout */}
      <div className="max-w-6xl mx-auto perspective-1000 grid grid-rows-[auto_1fr] gap-6">
        {/* Row 1: Human Holographic Dealer - Naturally positioned in its own row */}
        <div className="relative z-50 flex flex-col items-center">
          <HumanHolographicDealer
            dealerType={dealerType}
            phrase={dealerPhrase}
            mood={dealerMood}
            isAnimating={isDealing || isShuffling || isCelebrating}
            isDealing={isDealing}
            isShuffling={isShuffling}
            isCelebrating={isCelebrating}
            size="normal"
          />
          
          {onTipDealer && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onTipDealer}
              className="mt-4 bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold px-6 py-2 rounded-full border-2 border-yellow-300 shadow-lg hover:shadow-xl transition-all"
            >
              <DollarSign className="w-4 h-4 inline mr-1" />
              Tip Dealer
            </motion.button>
          )}
        </div>

        {/* Row 2: Walnut Wood Frame - Enhanced */}
        <div className="bg-gradient-to-br from-amber-900 via-yellow-900 to-amber-950 p-8 rounded-[3rem] shadow-2xl relative">
          {/* Gold Trim with shine effect */}
          <div className="absolute inset-0 rounded-[3rem] border-4 border-yellow-600/50" />
          <div className="absolute inset-0 rounded-[3rem] border-2 border-yellow-400/30" style={{
            boxShadow: 'inset 0 2px 10px rgba(255, 215, 0, 0.3)'
          }} />
          
          {/* Green Felt Surface with better texture */}
          <div className="bg-gradient-to-br from-green-800 via-green-900 to-green-800 rounded-3xl p-8 min-h-[600px] relative overflow-hidden">
            {/* Enhanced felt texture */}
            <div className="absolute inset-0 opacity-40 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOSIgbnVtT2N0YXZlcz0iNCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] pointer-events-none" />
            
            {/* Subtle radial gradient for depth */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.2)_100%)]" />
            
            {/* === DEALER SECTION (TOP 25%) === */}
            <div className="relative z-10 h-[180px]">
              {/* Dealer Score Badge */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-red-900/80 backdrop-blur-sm px-6 py-2 rounded-full border-2 border-red-400/70 shadow-xl"
                >
                  <p className="text-red-200 text-sm font-bold">
                    Dealer: <span className="text-white text-xl ml-2">{dealerScore}</span>
                  </p>
                </motion.div>
              </div>
              
              {/* Dealer Cards - Positioned with prominent arc layout */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-full h-32">
                <div className="relative h-full flex justify-center items-center">
                  {dealerCards.map((card, i) => {
                    // Calculate prominent arc position
                    const totalCards = dealerCards.length;
                    const center = (totalCards - 1) / 2;
                    const offset = (i - center); // -1, 0, 1 for 3 cards
                    const rotation = offset * 12; // Increased to 12° for visibility
                    const xOffset = offset * 45; // Horizontal spread
                    const yOffset = Math.abs(offset) * -20; // Arc curve
                    
                    return (
                      <motion.div
                        key={`item-${i}`}
                        initial={{ 
                          y: -200, 
                          x: 0, 
                          opacity: 0, 
                          scale: 0.3,
                          rotate: 0 
                        }}
                        animate={{ 
                          y: yOffset, 
                          x: xOffset, 
                          opacity: 1, 
                          scale: 1,
                          rotate: rotation
                        }}
                        transition={{ 
                          duration: 0.6, 
                          delay: i * 0.15,
                          ease: "easeOut"
                        }}
                        className="absolute"
                        style={{ 
                          transformOrigin: 'bottom center',
                          left: '50%',
                          top: '50%'
                        }}
                      >
                        <PlayingCard
                          card={card}
                          style={cardStyle}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* === CENTER PLAY AREA (50%) === */}
            <div className="relative z-10 h-[250px] flex items-center justify-center">
              {/* Betting Circle (printed on felt) */}
              <div className="relative">
                <div className="w-56 h-56 rounded-full border-4 border-dashed border-yellow-600/40 flex items-center justify-center relative">
                  <div className="absolute inset-4 rounded-full border-2 border-yellow-600/20" />
                  <div className="text-center">
                    <p className="text-yellow-600/60 text-lg font-bold tracking-wider">BETTING</p>
                    <p className="text-yellow-600/60 text-sm font-bold tracking-wider">CIRCLE</p>
                  </div>
                  
                  {/* Current bet display in center */}
                  {currentBet > 0 && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="bg-gradient-to-br from-red-600 to-red-800 w-20 h-20 rounded-full border-4 border-white shadow-2xl flex items-center justify-center">
                        <p className="text-white font-black text-lg">${currentBet}</p>
                      </div>
                    </motion.div>
                  )}
                </div>
                
                {/* Subtle shadow under betting circle */}
                <div className="absolute inset-0 rounded-full bg-black/20 blur-xl -z-10 scale-90" />
              </div>
              
              {/* Card Count Display */}
              {cardCount !== 0 && showStats && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm px-4 py-2 rounded-xl border-2 border-yellow-500"
                >
                  <p className="text-yellow-400 text-sm font-bold">
                    Count: <span className={cardCount > 0 ? 'text-green-400' : 'text-red-400'}>
                      {cardCount > 0 ? '+' : ''}{cardCount}
                    </span>
                  </p>
                </motion.div>
              )}
            </div>
            
            {/* === PLAYER SECTION (BOTTOM 25%) === */}
            <div className="relative z-10 h-[180px]">
              {/* Player Score Badge */}
              <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-blue-900/80 backdrop-blur-sm px-6 py-2 rounded-full border-2 border-blue-400/70 shadow-xl"
                >
                  <p className="text-blue-200 text-sm font-bold">
                    You: <span className="text-white text-xl ml-2">{playerScore}</span>
                  </p>
                </motion.div>
              </div>
              
              {/* Player Cards - Prominent arc formation at bottom */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full h-32">
                <div className="relative h-full flex justify-center items-center">
                  {playerCards.map((card, i) => {
                    const totalCards = playerCards.length;
                    const center = (totalCards - 1) / 2;
                    const offset = (i - center);
                    const rotation = offset * -12; // Opposite rotation, 12°
                    const xOffset = offset * 45;
                    const yOffset = Math.abs(offset) * -20; // Upward arc
                    
                    return (
                      <motion.div
                        key={`item-${i}`}
                        initial={{ 
                          y: 200, 
                          x: 0, 
                          opacity: 0, 
                          scale: 0.3,
                          rotate: 0 
                        }}
                        animate={{ 
                          y: yOffset, 
                          x: xOffset, 
                          opacity: 1, 
                          scale: 1,
                          rotate: rotation
                        }}
                        transition={{ 
                          duration: 0.6, 
                          delay: i * 0.15 + 0.3,
                          ease: "easeOut"
                        }}
                        className="absolute"
                        style={{ 
                          transformOrigin: 'top center',
                          left: '50%',
                          top: '50%'
                        }}
                        whileHover={{ 
                          scale: 1.15, 
                          y: yOffset - 15,
                          rotate: 0,
                          transition: { duration: 0.2 }
                        }}
                      >
                        <PlayingCard
                          card={card}
                          style={cardStyle}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons Below Table */}
        {gamePhase === 'playing' && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex justify-center gap-4 mt-8"
          >
            {onHit && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onHit}
                disabled={disabled}
                className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-bold px-12 py-4 rounded-xl border-2 border-green-400 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xl"
              >
                HIT
              </motion.button>
            )}
            
            {onStand && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStand}
                disabled={disabled}
                className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold px-12 py-4 rounded-xl border-2 border-red-400 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xl"
              >
                STAND
              </motion.button>
            )}
            
            {onDouble && playerCards.length === 2 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onDouble}
                disabled={disabled || balance < currentBet}
                className="bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-700 hover:to-amber-800 text-black font-bold px-12 py-4 rounded-xl border-2 border-yellow-400 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xl"
              >
                DOUBLE
              </motion.button>
            )}
          </motion.div>
        )}
        
        {/* Custom children (for game-specific UI) */}
        <div className="mt-6">
          {children}
        </div>
      </div>
    </div>
  );
}
