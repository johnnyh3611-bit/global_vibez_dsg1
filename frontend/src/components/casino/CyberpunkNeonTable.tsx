
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import MetaHumanDealer from '../MetaHumanDealer';
import PlayingCard from './PlayingCard';
import { Volume2, VolumeX, TrendingUp, TrendingDown, DollarSign, Zap } from 'lucide-react';
import type { CasinoTableLayoutCommonProps } from '@/types/casinoTableLayout';

/**
 * Cyberpunk Neon Gaming Table
 * Futuristic holographic table with RGB lighting and particle effects
 */

export default function CyberpunkNeonTable({
  balance = 1000,
  currentBet = 0,
  dealerCards = [],
  playerCards = [],
  dealerScore = 0,
  playerScore = 0,
  dealerPhrase = 'welcome',
  dealerMood = 'excited',
  isDealing = false,
  isShuffling = false,
  isCelebrating = false,
  onHit,
  onStand,
  onDouble,
  onTipDealer,
  soundEnabled = true,
  onToggleSound,
  cardStyle = 'cyberpunk',
  cardCount = 0,
  winStreak = 0,
  lossStreak = 0,
  gamePhase = 'betting',
  disabled = false,
  children
}: CasinoTableLayoutCommonProps) {
  const [particles, setParticles] = useState([]);

  // Generate particle effect on card deal
  React.useEffect(() => {
    if (isDealing) {
      const newParticles = Array.from({ length: 20 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.random() * 100,
        y: Math.random() * 100
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 2000);
    }
  }, [isDealing]);

  return (
    <div className="relative min-h-screen bg-black p-6 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 via-purple-900/20 to-pink-900/20 animate-pulse-slow" />
      
      {/* Matrix-style code rain (decorative) */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="text-cyan-400 text-xs font-mono overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={`item-${i}`}
              className="absolute animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 5}s`
              }}
            >
              {Math.random().toString(36).substring(7)}
            </div>
          ))}
        </div>
      </div>
      
      {/* Particle System */}
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ x: `${particle.x}%`, y: `${particle.y}%`, scale: 0, opacity: 1 }}
          animate={{ 
            x: `${particle.x + (Math.random() - 0.5) * 50}%`,
            y: `${particle.y - 100}%`,
            scale: 1,
            opacity: 0
          }}
          transition={{ duration: 2 }}
          className="absolute w-2 h-2 bg-cyan-400 rounded-full pointer-events-none"
          style={{ boxShadow: '0 0 10px #00ffff' }}
        />
      ))}
      
      {/* Top HUD */}
      <div className="max-w-6xl mx-auto mb-6 relative z-10">
        <div className="flex items-center justify-between">
          {/* Left: Holographic Stats */}
          <div className="flex items-center gap-4">
            {/* Balance */}
            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="relative bg-black/80 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-cyan-500 shadow-2xl shadow-cyan-500/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/5 to-transparent animate-scan" />
              <p className="text-cyan-400 text-xs font-bold relative z-10">💰 BALANCE</p>
              <p className="text-white text-3xl font-black relative z-10 text-shadow-neon">${balance.toLocaleString()}</p>
            </motion.div>
            
            {/* Streak */}
            {(winStreak > 0 || lossStreak > 0) && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`px-4 py-2 rounded-xl border-2 backdrop-blur-xl ${
                  winStreak > 0 
                    ? 'bg-green-500/20 border-green-400 shadow-green-400/50' 
                    : 'bg-red-500/20 border-red-400 shadow-red-400/50'
                } shadow-xl`}
              >
                {winStreak > 0 ? (
                  <>
                    <Zap className="w-5 h-5 text-green-400 inline mr-2 animate-pulse" />
                    <span className="text-green-300 font-bold">{winStreak}x STREAK</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-5 h-5 text-red-400 inline mr-2" />
                    <span className="text-red-300 font-bold">-{lossStreak}</span>
                  </>
                )}
              </motion.div>
            )}
          </div>
          
          {/* Right: Bet & Controls */}
          <div className="flex items-center gap-4">
            {/* Current Bet */}
            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="relative bg-black/80 backdrop-blur-xl px-6 py-3 rounded-xl border-2 border-pink-500 shadow-2xl shadow-pink-500/50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl" />
              <p className="text-pink-400 text-xs font-bold relative z-10">🎲 BET</p>
              <p className="text-white text-3xl font-black relative z-10 text-shadow-neon">${currentBet}</p>
            </motion.div>
            
            {/* Sound Toggle */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onToggleSound}
              className="p-3 bg-black/80 backdrop-blur-xl hover:bg-cyan-500/20 rounded-xl border-2 border-cyan-500/50 hover:border-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
            >
              {soundEnabled ? (
                <Volume2 className="w-6 h-6 text-cyan-400" />
              ) : (
                <VolumeX className="w-6 h-6 text-gray-500" />
              )}
            </motion.button>
          </div>
        </div>
      </div>
      
      {/* Main Table */}
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Nova Floating Hologram */}
        <div className="mb-8">
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <MetaHumanDealer dealerType="nova" gameType="default" gameState={{}}
              phrase={dealerPhrase}
              mood={dealerMood}
              isAnimating={isDealing || isShuffling || isCelebrating}
              isDealing={isDealing}
              isShuffling={isShuffling}
            isCelebrating={isCelebrating}
              size="normal"
            />
          </motion.div>
          
          {/* Tip Nova */}
          {onTipDealer && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onTipDealer}
              className="mt-4 mx-auto block bg-gradient-to-r from-cyan-500 to-pink-500 text-black font-bold px-6 py-2 rounded-full border-2 border-white/50 shadow-xl shadow-cyan-500/30 hover:shadow-pink-500/50 transition-all"
            >
              <DollarSign className="w-4 h-4 inline mr-1" />
              TIP NOVA
            </motion.button>
          )}
        </div>
        
        {/* Holographic Gaming Surface */}
        <div className="relative">
          {/* Chrome Edge with RGB Lighting */}
          <div className="absolute -inset-2 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-3xl blur-xl opacity-50 animate-pulse-slow" />
          
          {/* Table Surface */}
          <div className="relative bg-black/90 backdrop-blur-2xl rounded-3xl border-2 border-cyan-500/50 shadow-2xl overflow-hidden">
            {/* Animated RGB border */}
            <div className="absolute inset-0 rounded-3xl">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-30 animate-gradient" />
            </div>
            
            {/* Glass surface effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-pink-500/5" />
            
            {/* Scan lines */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/5 to-transparent animate-scan pointer-events-none" />
            
            {/* Content */}
            <div className="relative z-10 p-8 min-h-[500px]">
              {/* Dealer Area */}
              <div className="mb-8">
                <div className="bg-red-500/20 backdrop-blur-sm px-4 py-2 rounded-full border-2 border-red-500/50 inline-block mb-4 shadow-lg shadow-red-500/30">
                  <p className="text-red-300 text-sm font-bold">
                    DEALER: <span className="text-white text-xl ml-2">{dealerScore}</span>
                  </p>
                </div>
                
                {/* Dealer Cards with Neon Trail */}
                <div className="flex justify-center gap-3">
                  {dealerCards.map((card, i) => (
                    <div key={(card as any)?.id || `dealerCards-${i}`} className="relative">
                      {/* Neon trail */}
                      <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-lg" />
                      <PlayingCard
                        card={card}
                        style={cardStyle}
                        animateIn={true}
                        delay={i * 0.3}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Holographic Betting Zone */}
              <div className="my-8 flex justify-center">
                <motion.div
                  animate={{ 
                    boxShadow: [
                      '0 0 20px rgba(0,255,255,0.3)',
                      '0 0 40px rgba(255,0,255,0.5)',
                      '0 0 20px rgba(0,255,255,0.3)'
                    ]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-48 h-48 rounded-full border-4 border-purple-500/40 flex items-center justify-center relative"
                >
                  <div className="absolute inset-2 rounded-full border-2 border-cyan-500/20" />
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 rounded-full animate-spin-slow" />
                  <p className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-400 text-lg font-bold relative z-10">
                    BET ZONE
                  </p>
                </motion.div>
              </div>
              
              {/* Player Area */}
              <div className="mt-8">
                <div className="bg-cyan-500/20 backdrop-blur-sm px-4 py-2 rounded-full border-2 border-cyan-500/50 inline-block mb-4 shadow-lg shadow-cyan-500/30">
                  <p className="text-cyan-300 text-sm font-bold">
                    YOU: <span className="text-white text-xl ml-2">{playerScore}</span>
                  </p>
                </div>
                
                {/* Player Cards with Pink Glow */}
                <div className="flex justify-center gap-3">
                  {playerCards.map((card, i) => (
                    <div key={(card as any)?.id || `playerCards-${i}`} className="relative">
                      {/* Pink glow */}
                      <div className="absolute inset-0 bg-pink-500/20 blur-xl rounded-lg" />
                      <PlayingCard
                        card={card}
                        style={cardStyle}
                        animateIn={true}
                        delay={i * 0.3 + 0.5}
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Card Count HUD */}
              {cardCount !== 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute top-4 right-4 bg-black/90 backdrop-blur-xl px-4 py-2 rounded-xl border-2 border-yellow-500 shadow-xl shadow-yellow-500/50"
                >
                  <p className="text-yellow-400 text-sm font-bold">
                    COUNT: <span className={cardCount > 0 ? 'text-green-400' : 'text-red-400'}>
                      {cardCount > 0 ? '+' : ''}{cardCount}
                    </span>
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
        
        {/* Neon Action Buttons */}
        {gamePhase === 'playing' && (
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex justify-center gap-4 mt-8"
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(0,255,255,0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={onHit}
              disabled={disabled}
              className="relative bg-gradient-to-r from-cyan-600 to-cyan-700 text-white font-bold px-12 py-4 rounded-xl border-2 border-cyan-400 shadow-xl shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-xl overflow-hidden group"
            >
              <span className="relative z-10">⚡ HIT</span>
              <div className="absolute inset-0 bg-cyan-400/20 translate-y-full group-hover:translate-y-0 transition-transform" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255,0,255,0.5)' }}
              whileTap={{ scale: 0.95 }}
              onClick={onStand}
              disabled={disabled}
              className="relative bg-gradient-to-r from-pink-600 to-pink-700 text-white font-bold px-12 py-4 rounded-xl border-2 border-pink-400 shadow-xl shadow-pink-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-xl overflow-hidden group"
            >
              <span className="relative z-10">⚡ STAND</span>
              <div className="absolute inset-0 bg-pink-400/20 translate-y-full group-hover:translate-y-0 transition-transform" />
            </motion.button>
            
            {onDouble && playerCards.length === 2 && (
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(168,85,247,0.5)' }}
                whileTap={{ scale: 0.95 }}
                onClick={onDouble}
                disabled={disabled || balance < currentBet}
                className="relative bg-gradient-to-r from-purple-600 to-purple-700 text-white font-bold px-12 py-4 rounded-xl border-2 border-purple-400 shadow-xl shadow-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed text-xl overflow-hidden group"
              >
                <span className="relative z-10">⚡ DOUBLE</span>
                <div className="absolute inset-0 bg-purple-400/20 translate-y-full group-hover:translate-y-0 transition-transform" />
              </motion.button>
            )}
          </motion.div>
        )}
        
        {children}
      </div>
    </div>
  );
}
