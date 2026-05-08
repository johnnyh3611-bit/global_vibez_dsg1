import React, { useState } from 'react';
import { motion } from 'framer-motion';
import NovaDealer from './NovaDealer';
import PlayingCard from './PlayingCard';
import { Volume2, VolumeX, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

/**
 * Classic Casino Green Felt Table Layout
 * Traditional Vegas-style casino table with authentic feel
 */

export default function ClassicCasinoTable({
  // Player stats
  balance = 1000,
  currentBet = 0,
  
  // Game state
  dealerCards = [],
  playerCards = [],
  dealerScore = 0,
  playerScore = 0,
  
  // Nova dealer
  dealerPhrase = 'welcome',
  dealerMood = 'professional',
  isDealing = false,
  isShuffling = false,
  isCelebrating = false,
  
  // Actions
  onHit,
  onStand,
  onDouble,
  onTipDealer,
  
  // Settings
  soundEnabled = true,
  onToggleSound,
  cardStyle = 'realistic',
  
  // Additional features
  cardCount = 0,
  winStreak = 0,
  lossStreak = 0,
  
  // State
  gamePhase = 'betting', // betting, playing, finished
  disabled = false,
  
  children
}) {
  const [showStats, setShowStats] = useState(true);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-amber-900/20 via-yellow-900/20 to-amber-800/20 p-6">
      {/* Casino ambient lighting effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,0,0.05)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Top Stats Bar */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          {/* Left: Balance & Streak */}
          <div className="flex items-center gap-4">
            {/* Balance */}
            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-gradient-to-r from-yellow-600 to-amber-700 px-6 py-3 rounded-2xl border-2 border-yellow-400 shadow-2xl"
            >
              <p className="text-yellow-200 text-xs font-bold">Balance</p>
              <p className="text-white text-3xl font-black">${balance.toLocaleString()}</p>
            </motion.div>
            
            {/* Win/Loss Streak */}
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
            {/* Current Bet */}
            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-3 rounded-2xl border-2 border-green-400 shadow-2xl"
            >
              <p className="text-green-200 text-xs font-bold">Current Bet</p>
              <p className="text-white text-3xl font-black">${currentBet}</p>
            </motion.div>
            
            {/* Sound Toggle */}
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
      
      {/* Main Table Container */}
      <div className="max-w-6xl mx-auto">
        {/* Nova Dealer Section */}
        <div className="mb-8">
          <NovaDealer
            phrase={dealerPhrase}
            mood={dealerMood}
            isAnimating={isDealing || isShuffling || isCelebrating}
            isDealing={isDealing}
            isShuffling={isShuffling}
            isCelebrating={isCelebrating}
            size="normal"
          />
          
          {/* Tip Dealer Button */}
          {onTipDealer && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onTipDealer}
              className="mt-4 mx-auto block bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold px-6 py-2 rounded-full border-2 border-yellow-300 shadow-lg hover:shadow-xl transition-all"
            >
              <DollarSign className="w-4 h-4 inline mr-1" />
              Tip Nova
            </motion.button>
          )}
        </div>
        
        {/* Casino Table */}
        <div className="relative">
          {/* Walnut Wood Frame */}
          <div className="bg-gradient-to-br from-amber-900 via-yellow-900 to-amber-950 p-6 rounded-3xl shadow-2xl">
            {/* Gold Trim */}
            <div className="absolute inset-0 rounded-3xl border-4 border-yellow-600/50" />
            
            {/* Green Felt Surface */}
            <div className="bg-gradient-to-br from-green-800 via-green-900 to-green-800 rounded-2xl p-8 min-h-[500px] relative overflow-hidden">
              {/* Felt Texture Overlay */}
              <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOSIgbnVtT2N0YXZlcz0iNCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuMyIvPjwvc3ZnPg==')] pointer-events-none" />
              
              {/* Dealer Area */}
              <div className="relative z-10 mb-8">
                <div className="bg-red-900/40 px-4 py-2 rounded-full border-2 border-red-500/50 inline-block mb-4 shadow-lg">
                  <p className="text-red-300 text-sm font-bold">
                    Dealer: <span className="text-white text-xl ml-2">{dealerScore}</span>
                  </p>
                </div>
                
                {/* Dealer Cards */}
                <div className="flex justify-center gap-3">
                  {dealerCards.map((card, i) => (
                    <PlayingCard
                      key={card.id || `dealerCards-${i}`}
                      card={card}
                      style={cardStyle}
                      animateIn={true}
                      delay={i * 0.3}
                    />
                  ))}
                </div>
              </div>
              
              {/* Betting Circle (printed on felt) */}
              <div className="my-8 flex justify-center">
                <div className="w-48 h-48 rounded-full border-4 border-yellow-600/40 flex items-center justify-center relative">
                  <div className="absolute inset-2 rounded-full border-2 border-yellow-600/20" />
                  <p className="text-yellow-600/60 text-lg font-bold">BETTING AREA</p>
                </div>
              </div>
              
              {/* Player Area */}
              <div className="relative z-10 mt-8">
                <div className="bg-blue-900/40 px-4 py-2 rounded-full border-2 border-blue-500/50 inline-block mb-4 shadow-lg">
                  <p className="text-blue-300 text-sm font-bold">
                    You: <span className="text-white text-xl ml-2">{playerScore}</span>
                  </p>
                </div>
                
                {/* Player Cards */}
                <div className="flex justify-center gap-3">
                  {playerCards.map((card, i) => (
                    <PlayingCard
                      key={card.id || `playerCards-${i}`}
                      card={card}
                      style={cardStyle}
                      animateIn={true}
                      delay={i * 0.3 + 0.5}
                    />
                  ))}
                </div>
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
          </div>
        </div>
        
        {/* Action Buttons */}
        {gamePhase === 'playing' && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex justify-center gap-4 mt-8"
          >
            <button
              onClick={onHit}
              disabled={disabled}
              className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-bold px-12 py-4 rounded-xl border-2 border-green-400 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xl"
            >
              HIT
            </button>
            
            <button
              onClick={onStand}
              disabled={disabled}
              className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-bold px-12 py-4 rounded-xl border-2 border-red-400 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xl"
            >
              STAND
            </button>
            
            {onDouble && playerCards.length === 2 && (
              <button
                onClick={onDouble}
                disabled={disabled || balance < currentBet}
                className="bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-700 hover:to-amber-800 text-black font-bold px-12 py-4 rounded-xl border-2 border-yellow-400 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xl"
              >
                DOUBLE
              </button>
            )}
          </motion.div>
        )}
        
        {/* Custom children (for game-specific UI) */}
        {children}
      </div>
    </div>
  );
}
