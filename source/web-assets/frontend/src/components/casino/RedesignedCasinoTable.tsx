import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CasinoCard from './CasinoCard';
import CasinoChip from './CasinoChip';

export default function RedesignedCasinoTable({
  gameType = 'blackjack', // 'blackjack' or 'poker'
  playerHand = [],
  dealerHand = [],
  communityCards = [],
  playerChips = 1000,
  currentBet = 0,
  pot = 0,
  onHit,
  onStand,
  onDouble,
  onSplit,
  // Poker actions
  onFold,
  onCall,
  onRaise,
  onBet,
  disabled = false,
  gameOver = false,
  dealerStyle = 'elegant_female'
}: {
  gameType?: string;
  playerHand?: any[];
  dealerHand?: any[];
  communityCards?: any[];
  playerChips?: number;
  currentBet?: number;
  pot?: number;
  onHit?: any;
  onStand?: any;
  onDouble?: any;
  onSplit?: any;
  onFold?: any;
  onCall?: any;
  onRaise?: any;
  onBet?: any;
  disabled?: boolean;
  gameOver?: boolean;
  dealerStyle?: string;
}) {
  const [selectedChipValue, setSelectedChipValue] = useState(25);

  // Parse card string to object (e.g., "AS" -> {value: "A", suit: "spades"})
  const parseCard = (cardStr: string | null | undefined) => {
    if (!cardStr || typeof cardStr !== 'string') return null;
    const value = cardStr.slice(0, -1);
    const suitCode = cardStr.slice(-1);
    const suitMap: Record<string, string> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
    return { value, suit: suitMap[suitCode] || 'spades' };
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden" 
      style={{
        background: 'radial-gradient(circle at 50% 50%, #1A0B2E 0%, #08030F 60%, #000000 100%)'
      }}
    >
      {/* Ambient neon glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00F0FF]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-[120px]" />
      </div>

      {/* Main content container */}
      <div className="relative z-10 h-screen flex flex-col items-center justify-between p-8 md:p-12">
        
        {/* TOP SECTION - Dealer / Opponents */}
        <div className="w-full max-w-6xl">
          {gameType === 'blackjack' && (
            <div className="flex flex-col items-center gap-6">
              {/* Dealer label */}
              <div className="text-xs md:text-sm font-sans font-semibold uppercase tracking-[0.2em] text-white/40">
                Dealer
              </div>
              
              {/* Dealer cards */}
              <div className="flex gap-4">
                {dealerHand.map((card, index) => {
                  const parsed = parseCard(card);
                  return parsed ? (
                    <CasinoCard
                      key={`dealerHand-${index}`}
                      value={parsed.value}
                      suit={parsed.suit}
                      isFaceUp={index === 0 || gameOver}
                      animate={true}
                    />
                  ) : null;
                })}
              </div>
            </div>
          )}

          {gameType === 'poker' && communityCards.length > 0 && (
            <div className="flex flex-col items-center gap-6">
              <div className="text-xs md:text-sm font-sans font-semibold uppercase tracking-[0.2em] text-white/40">
                Community Cards
              </div>
              <div className="flex gap-4">
                {communityCards.slice(0, 5).map((card, index) => {
                  const parsed = parseCard(card);
                  return parsed ? (
                    <CasinoCard
                      key={`item-${index}`}
                      value={parsed.value}
                      suit={parsed.suit}
                    />
                  ) : (
                    <div key={`item-${index}`} className="aspect-[5/7] w-20 md:w-32 lg:w-40 rounded-xl border-2 border-dashed border-[#D4AF37]/30 bg-black/20" />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* CENTER SECTION - Pot / Status */}
        <div className="flex flex-col items-center gap-6">
          {gameType === 'poker' && pot > 0 && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="px-12 py-6 rounded-full bg-black/40 backdrop-blur-xl border border-white/10"
            >
              <div className="text-xs text-[#D4AF37] font-sans font-semibold mb-1 tracking-widest">💰 POT</div>
              <div className="text-4xl md:text-5xl font-black text-transparent bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#D4AF37] bg-clip-text">
                ${pot}
              </div>
            </motion.div>
          )}

          {/* Player chips display */}
          <div className="px-8 py-3 rounded-lg bg-black/40 backdrop-blur-xl border border-white/10">
            <div className="text-xs text-white/40 font-sans font-semibold mb-1 tracking-widest">YOUR CHIPS</div>
            <div className="text-2xl md:text-3xl font-bold text-[#00F0FF] font-sans tracking-widest">
              ${playerChips}
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION - Player Area */}
        <div className="w-full max-w-6xl flex flex-col items-center gap-8">
          
          {/* Betting zone (for blackjack) */}
          {gameType === 'blackjack' && currentBet > 0 && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-dashed border-[#D4AF37] 
                bg-black/20 flex items-center justify-center">
                <CasinoChip value={25} count={Math.floor(currentBet / 25)} />
              </div>
              <div className="text-sm text-white/60 font-sans tracking-wider">
                Current Bet: ${currentBet}
              </div>
            </div>
          )}

          {/* Player cards - DEALT ABOVE betting zone */}
          <div className="flex gap-4">
            {playerHand.map((card, index) => {
              const parsed = parseCard(card);
              return parsed ? (
                <CasinoCard
                  key={card.id || `playerHand-${index}`}
                  value={parsed.value}
                  suit={parsed.suit}
                />
              ) : null;
            })}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-4 justify-center">
            {gameType === 'blackjack' && !gameOver && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 20px #00F0FF' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onHit}
                  disabled={disabled}
                  className="px-8 py-3 bg-transparent border-2 border-[#00F0FF] text-[#00F0FF] font-sans font-bold text-lg 
                    uppercase tracking-[0.15em] hover:bg-[#00F0FF] hover:text-black transition-all duration-300 
                    disabled:opacity-30 disabled:cursor-not-allowed rounded-none
                    focus:ring-2 focus:ring-[#00F0FF] focus:outline-none focus:ring-offset-2 focus:ring-offset-black"
                  style={{
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                  }}
                  data-testid="action-hit"
                >
                  HIT
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 20px #FF003C' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onStand}
                  disabled={disabled}
                  className="px-8 py-3 bg-transparent border-2 border-[#FF003C] text-[#FF003C] font-sans font-bold text-lg 
                    uppercase tracking-[0.15em] hover:bg-[#FF003C] hover:text-black transition-all duration-300 
                    disabled:opacity-30 disabled:cursor-not-allowed rounded-none
                    focus:ring-2 focus:ring-[#FF003C] focus:outline-none focus:ring-offset-2 focus:ring-offset-black"
                  style={{
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                  }}
                  data-testid="action-stand"
                >
                  STAND
                </motion.button>

                {onDouble && playerHand.length === 2 && (
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: '0 0 20px #D4AF37' }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onDouble}
                    disabled={disabled || playerChips < currentBet}
                    className="px-8 py-3 bg-transparent border border-white/20 text-[#D4AF37] font-sans font-bold text-lg 
                      uppercase tracking-[0.15em] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-all duration-300 
                      disabled:opacity-30 disabled:cursor-not-allowed rounded-none"
                    data-testid="action-double"
                  >
                    DOUBLE
                  </motion.button>
                )}
              </>
            )}

            {gameType === 'poker' && !gameOver && (
              <>
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 20px #FF003C' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onFold}
                  disabled={disabled}
                  className="px-8 py-3 bg-transparent border-2 border-[#FF003C] text-[#FF003C] font-sans font-bold text-lg 
                    uppercase tracking-[0.15em] hover:bg-[#FF003C] hover:text-black transition-all duration-300 
                    disabled:opacity-30 disabled:cursor-not-allowed rounded-none"
                  style={{
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                  }}
                  data-testid="action-fold"
                >
                  FOLD
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 20px #00F0FF' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onCall}
                  disabled={disabled}
                  className="px-8 py-3 bg-transparent border-2 border-[#00F0FF] text-[#00F0FF] font-sans font-bold text-lg 
                    uppercase tracking-[0.15em] hover:bg-[#00F0FF] hover:text-black transition-all duration-300 
                    disabled:opacity-30 disabled:cursor-not-allowed rounded-none"
                  style={{
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                  }}
                  data-testid="action-call"
                >
                  CALL ${currentBet}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 0 20px #D4AF37' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onRaise}
                  disabled={disabled}
                  className="px-8 py-3 bg-transparent border-2 border-[#D4AF37] text-[#D4AF37] font-sans font-bold text-lg 
                    uppercase tracking-[0.15em] hover:bg-[#D4AF37] hover:text-black transition-all duration-300 
                    disabled:opacity-30 disabled:cursor-not-allowed rounded-none"
                  style={{
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)'
                  }}
                  data-testid="action-raise"
                >
                  RAISE
                </motion.button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
