
import React from 'react';
import { motion } from 'framer-motion';
import MetaHumanDealer from '../MetaHumanDealer';
import PlayingCard from './PlayingCard';
import { Volume2, VolumeX, DollarSign } from 'lucide-react';
import type { CasinoTableLayoutCommonProps } from '@/types/casinoTableLayout';

/**
 * Minimalist/Clean Table
 * Simple, distraction-free design focused purely on gameplay
 */

export default function MinimalistTable({
  balance = 1000,
  currentBet = 0,
  dealerCards = [],
  playerCards = [],
  dealerScore = 0,
  playerScore = 0,
  dealerPhrase = 'welcome',
  dealerMood = 'neutral',
  isDealing = false,
  isShuffling = false,
  isCelebrating = false,
  onHit,
  onStand,
  onDouble,
  onTipDealer,
  soundEnabled = true,
  onToggleSound,
  cardStyle = 'modern',
  cardCount = 0,
  winStreak = 0,
  lossStreak = 0,
  gamePhase = 'betting',
  disabled = false,
  children
}: CasinoTableLayoutCommonProps) {
  return (
    <div className="relative min-h-screen bg-gray-50 p-6">
      {/* Simple Top Bar */}
      <div className="max-w-5xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-md p-4 flex items-center justify-between border border-gray-200">
          {/* Left: Stats */}
          <div className="flex items-center gap-6">
            <div>
              <p className="text-gray-500 text-xs font-semibold">Balance</p>
              <p className="text-gray-900 text-2xl font-bold">${balance.toLocaleString()}</p>
            </div>
            <div className="h-10 w-px bg-gray-200" />
            <div>
              <p className="text-gray-500 text-xs font-semibold">Bet</p>
              <p className="text-gray-900 text-2xl font-bold">${currentBet}</p>
            </div>
            {(winStreak > 0 || lossStreak > 0) && (
              <>
                <div className="h-10 w-px bg-gray-200" />
                <div>
                  <p className="text-gray-500 text-xs font-semibold">Streak</p>
                  <p className={`text-2xl font-bold ${
                    winStreak > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {winStreak > 0 ? `+${winStreak}` : `-${lossStreak}`}
                  </p>
                </div>
              </>
            )}
          </div>
          
          {/* Right: Sound Toggle */}
          <button
            onClick={onToggleSound}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-gray-700" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-5xl mx-auto">
        {/* Nova (compact) */}
        <div className="mb-6 text-center">
          <MetaHumanDealer dealerType="nova" gameType="default" gameState={{}}
            phrase={dealerPhrase}
            mood={dealerMood}
            isAnimating={isDealing || isShuffling || isCelebrating}
            isDealing={isDealing}
            isShuffling={isShuffling}
            isCelebrating={isCelebrating}
            size="small"
          />
          {onTipDealer && (
            <button
              onClick={onTipDealer}
              className="mt-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold px-4 py-1.5 rounded-lg text-sm transition-colors"
            >
              <DollarSign className="w-3 h-3 inline mr-1" />
              Tip
            </button>
          )}
        </div>
        
        {/* Game Area */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          {/* Dealer */}
          <div className="mb-12 text-center">
            <div className="inline-block bg-gray-100 px-4 py-1.5 rounded-full mb-4">
              <p className="text-gray-600 text-sm font-semibold">
                Dealer: <span className="text-gray-900 text-lg ml-1">{dealerScore}</span>
              </p>
            </div>
            <div className="flex justify-center gap-2">
              {dealerCards.map((card, i) => (
                <PlayingCard
                  key={(card as any)?.id || `dealerCards-${i}`}
                  card={card}
                  style={cardStyle}
                  size="normal"
                  animateIn={true}
                  delay={i * 0.2}
                />
              ))}
            </div>
          </div>
          
          {/* Divider */}
          <div className="border-t border-gray-200 my-8" />
          
          {/* Player */}
          <div className="text-center">
            <div className="inline-block bg-blue-50 px-4 py-1.5 rounded-full mb-4">
              <p className="text-blue-600 text-sm font-semibold">
                You: <span className="text-blue-900 text-lg ml-1">{playerScore}</span>
              </p>
            </div>
            <div className="flex justify-center gap-2">
              {playerCards.map((card, i) => (
                <PlayingCard
                  key={(card as any)?.id || `playerCards-${i}`}
                  card={card}
                  style={cardStyle}
                  size="normal"
                  animateIn={true}
                  delay={i * 0.2 + 0.3}
                />
              ))}
            </div>
          </div>
          
          {/* Card Count (subtle) */}
          {cardCount !== 0 && (
            <div className="absolute top-4 right-4 text-sm">
              <span className="text-gray-500">Count: </span>
              <span className={`font-bold ${
                cardCount > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {cardCount > 0 ? '+' : ''}{cardCount}
              </span>
            </div>
          )}
        </div>
        
        {/* Simple Action Buttons */}
        {gamePhase === 'playing' && (
          <div className="flex justify-center gap-3 mt-6">
            <button
              onClick={onHit}
              disabled={disabled}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-10 py-3 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hit
            </button>
            
            <button
              onClick={onStand}
              disabled={disabled}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-10 py-3 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stand
            </button>
            
            {onDouble && playerCards.length === 2 && (
              <button
                onClick={onDouble}
                disabled={disabled || balance < currentBet}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-10 py-3 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Double
              </button>
            )}
          </div>
        )}
        
        {children}
      </div>
    </div>
  );
}
