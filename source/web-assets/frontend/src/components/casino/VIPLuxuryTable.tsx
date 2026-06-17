
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import MetaHumanDealer from '../MetaHumanDealer';
import PlayingCard from './PlayingCard';
import { Volume2, VolumeX, TrendingUp, TrendingDown, DollarSign, Crown } from 'lucide-react';
import type { CasinoTableLayoutCommonProps } from '@/types/casinoTableLayout';

/**
 * VIP Luxury Dark Table
 * Premium black velvet table with gold accents and mahogany frame
 */

export default function VIPLuxuryTable({
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
  cardStyle = 'luxury',
  cardCount = 0,
  winStreak = 0,
  lossStreak = 0,
  gamePhase = 'betting',
  disabled = false,
  children
}: CasinoTableLayoutCommonProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 p-6">
      {/* Chandelier lighting effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-yellow-500/5 blur-3xl rounded-full pointer-events-none" />
      
      {/* Top Stats - Gold Theme */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          {/* Left: Balance & VIP Status */}
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-gradient-to-r from-yellow-600/20 to-amber-700/20 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-yellow-600 shadow-2xl shadow-yellow-900/50"
            >
              <p className="text-yellow-500 text-xs font-bold tracking-wider">⟨ BALANCE ⟩</p>
              <p className="text-yellow-100 text-3xl font-serif">${balance.toLocaleString()}</p>
            </motion.div>
            
            {/* VIP Crown */}
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="bg-gradient-to-br from-yellow-500 to-amber-600 p-3 rounded-full border-2 border-yellow-400 shadow-xl shadow-yellow-900/50"
            >
              <Crown className="w-6 h-6 text-black" />
            </motion.div>
            
            {/* Streak */}
            {(winStreak > 0 || lossStreak > 0) && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`px-4 py-2 rounded-xl border-2 backdrop-blur-xl ${
                  winStreak > 0 
                    ? 'bg-green-900/30 border-green-600' 
                    : 'bg-red-900/30 border-red-600'
                } shadow-xl`}
              >
                {winStreak > 0 ? (
                  <span className="text-green-400 font-bold">{winStreak}x WIN</span>
                ) : (
                  <span className="text-red-400 font-bold">-{lossStreak}</span>
                )}
              </motion.div>
            )}
          </div>
          
          {/* Right: Bet & Controls */}
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-gradient-to-r from-amber-900/20 to-yellow-900/20 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-amber-600 shadow-2xl shadow-amber-900/50"
            >
              <p className="text-amber-500 text-xs font-bold tracking-wider">⟨ BET ⟩</p>
              <p className="text-amber-100 text-3xl font-serif">${currentBet}</p>
            </motion.div>
            
            <button
              onClick={onToggleSound}
              className="p-3 bg-gray-900/80 hover:bg-gray-800 rounded-xl border-2 border-yellow-600/50 transition-all shadow-lg"
            >
              {soundEnabled ? (
                <Volume2 className="w-6 h-6 text-yellow-500" />
              ) : (
                <VolumeX className="w-6 h-6 text-gray-600" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Main Table */}
      <div className="max-w-6xl mx-auto">
        {/* Nova VIP Dealer */}
        <div className="mb-8">
          <MetaHumanDealer dealerType="nova" gameType="default" gameState={{}}
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
              className="mt-4 mx-auto block bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-bold px-6 py-2 rounded-full border-2 border-yellow-400 shadow-xl shadow-yellow-900/50 transition-all"
            >
              <DollarSign className="w-4 h-4 inline mr-1" />
              Tip Your Dealer
            </motion.button>
          )}
        </div>
        
        {/* Luxury Table */}
        <div className="relative">
          {/* Mahogany Frame */}
          <div className="bg-gradient-to-br from-amber-950 via-red-950 to-amber-950 p-8 rounded-3xl shadow-2xl">
            {/* Gold corner ornaments */}
            <div className="absolute top-2 left-2 w-12 h-12 border-t-4 border-l-4 border-yellow-500/80 rounded-tl-2xl" />
            <div className="absolute top-2 right-2 w-12 h-12 border-t-4 border-r-4 border-yellow-500/80 rounded-tr-2xl" />
            <div className="absolute bottom-2 left-2 w-12 h-12 border-b-4 border-l-4 border-yellow-500/80 rounded-bl-2xl" />
            <div className="absolute bottom-2 right-2 w-12 h-12 border-b-4 border-r-4 border-yellow-500/80 rounded-br-2xl" />
            
            {/* Diamond inlays */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={`item-${i}`}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                className="absolute w-2 h-2 bg-white/50 rotate-45"
                style={{
                  top: i < 4 ? '10%' : '90%',
                  left: `${20 + (i % 4) * 20}%`
                }}
              />
            ))}
            
            {/* Black Velvet Surface */}
            <div className="bg-gradient-to-br from-gray-950 via-black to-gray-900 rounded-2xl p-8 min-h-[500px] relative overflow-hidden border-2 border-yellow-700/30">
              {/* Velvet texture */}
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
              
              {/* Gold embroidery pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-4 border-2 border-yellow-600 rounded-xl" />
                <div className="absolute inset-8 border border-yellow-600/50 rounded-lg" />
              </div>
              
              {/* Dealer Area */}
              <div className="relative z-10 mb-8">
                <div className="bg-red-950/40 px-4 py-2 rounded-full border-2 border-red-800/50 inline-block mb-4 shadow-lg">
                  <p className="text-red-400 text-sm font-serif">
                    Dealer: <span className="text-yellow-100 text-xl ml-2">{dealerScore}</span>
                  </p>
                </div>
                
                <div className="flex justify-center gap-3">
                  {dealerCards.map((card, i) => (
                    <motion.div
                      key={(card as any)?.id || `dealerCards-${i}`}
                      initial={{ opacity: 0, y: -50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: i * 0.3 }}
                    >
                      <PlayingCard card={card} style={cardStyle} />
                    </motion.div>
                  ))}
                </div>
              </div>
              
              {/* Gold Printed Betting Area */}
              <div className="my-8 flex justify-center">
                <div className="w-48 h-48 rounded-full border-4 border-yellow-700/40 flex items-center justify-center relative">
                  <div className="absolute inset-2 rounded-full border-2 border-yellow-600/20" />
                  <p className="text-yellow-700/80 text-lg font-serif tracking-wider">BETTING</p>
                </div>
              </div>
              
              {/* Player Area */}
              <div className="relative z-10 mt-8">
                <div className="bg-blue-950/40 px-4 py-2 rounded-full border-2 border-blue-800/50 inline-block mb-4 shadow-lg">
                  <p className="text-blue-400 text-sm font-serif">
                    You: <span className="text-yellow-100 text-xl ml-2">{playerScore}</span>
                  </p>
                </div>
                
                <div className="flex justify-center gap-3">
                  {playerCards.map((card, i) => (
                    <motion.div
                      key={(card as any)?.id || `playerCards-${i}`}
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: i * 0.3 + 0.5 }}
                    >
                      <PlayingCard card={card} style={cardStyle} />
                    </motion.div>
                  ))}
                </div>
              </div>
              
              {/* Card Count */}
              {cardCount !== 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm px-4 py-2 rounded-xl border-2 border-yellow-600 shadow-xl"
                >
                  <p className="text-yellow-500 text-sm font-bold">
                    Count: <span className={cardCount > 0 ? 'text-green-400' : 'text-red-400'}>
                      {cardCount > 0 ? '+' : ''}{cardCount}
                    </span>
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
        
        {/* Elegant Action Buttons */}
        {gamePhase === 'playing' && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex justify-center gap-4 mt-8"
          >
            <button
              onClick={onHit}
              disabled={disabled}
              className="bg-gradient-to-r from-green-800 to-green-900 hover:from-green-700 hover:to-green-800 text-yellow-100 font-serif font-bold px-12 py-4 rounded-xl border-2 border-yellow-700 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 text-xl"
            >
              HIT
            </button>
            
            <button
              onClick={onStand}
              disabled={disabled}
              className="bg-gradient-to-r from-red-900 to-red-950 hover:from-red-800 hover:to-red-900 text-yellow-100 font-serif font-bold px-12 py-4 rounded-xl border-2 border-yellow-700 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 text-xl"
            >
              STAND
            </button>
            
            {onDouble && playerCards.length === 2 && (
              <button
                onClick={onDouble}
                disabled={disabled || balance < currentBet}
                className="bg-gradient-to-r from-yellow-700 to-amber-800 hover:from-yellow-600 hover:to-amber-700 text-black font-serif font-bold px-12 py-4 rounded-xl border-2 border-yellow-500 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 text-xl"
              >
                DOUBLE
              </button>
            )}
          </motion.div>
        )}
        
        {children}
      </div>
    </div>
  );
}
