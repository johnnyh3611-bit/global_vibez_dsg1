
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CasinoTable3D from '@/components/casino/CasinoTable3D';
import PlayingCard3D from '@/components/casino/PlayingCard3D';
import CasinoChip from '@/components/casino/CasinoChip';
import DealerUIPanel from '@/components/casino/DealerUIPanel';
import BackButton from '@/components/BackButton';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
import cardSoundManager from '@/utils/cardSoundManager';
import { CASINO_THEME, formatCurrency } from '@/utils/casinoTheme';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// AAA Blackjack - Professional casino experience matching Baccarat style
// Complete betting interface with BET ZONE, chip selector, and action buttons
export default function PracticeBlackjackNormal() {
  // Game State
  const [credits, setCredits] = useState(1000);
  const [currentBet, setCurrentBet] = useState(0);
  const [chipValue, setChipValue] = useState(25);
  const [currentGameState, setCurrentGameState] = useState('BETTING_OPEN'); // BETTING_OPEN, DEALING, PLAYER_TURN, DEALER_TURN, RESULT
  const [playerHand, setPlayerHand] = useState([]);
  const [dealerHand, setDealerHand] = useState([]);
  const [playerScore, setPlayerScore] = useState(0);
  const [dealerScore, setDealerScore] = useState(0);
  const [result, setResult] = useState(null);
  const [lastWin, setLastWin] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sessionId, setSessionId] = useState(null);

  const chipValues = [25, 50, 100, 500];

  // Place bet in BET ZONE
  const placeBet = () => {
    if (currentGameState !== 'BETTING_OPEN' || credits < chipValue) return;
    
    if (soundEnabled) cardSoundManager.playChipClink();
    setCurrentBet(currentBet + chipValue);
    setCredits(credits - chipValue);
  };

  // Clear bet
  const clearBet = () => {
    if (currentGameState !== 'BETTING_OPEN' || !currentBet) return;
    setCredits(credits + currentBet);
    setCurrentBet(0);
  };

  // Parse card string to object
  const parseCard = (cardStr) => {
    if (!cardStr || typeof cardStr !== 'string') return null;
    const value = cardStr.slice(0, -1);
    const suitCode = cardStr.slice(-1).toUpperCase();
    const suitMap = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
    return { value, suit: suitMap[suitCode] || 'spades' };
  };

  // Calculate hand value
  const calculateBlackjackValue = (hand) => {
    let total = 0;
    let aces = 0;
    
    hand.forEach(card => {
      const parsed = parseCard(card);
      if (!parsed) return;
      
      const value = parsed.value;
      if (value === 'A') {
        aces += 1;
        total += 11;
      } else if (['K', 'Q', 'J'].includes(value)) {
        total += 10;
      } else {
        total += parseInt(value);
      }
    });
    
    // Adjust for aces
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    
    return total;
  };

  // Deal cards
  const deal = async () => {
    if (currentBet === 0) return;

    setCurrentGameState('DEALING');
    if (soundEnabled) cardSoundManager.playCardShuffle();

    try {
      const response = await fetch(`${API_URL}/api/blackjack/deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: 'player_1',
          bet_amount: currentBet,
          side_bets: {},
          lightning_active: false,
          client_seed: Math.random().toString(36).substring(7)
        })
      });

      const data = await response.json();
      setSessionId(data.session_id);

      // Deal cards with faster animation
      setTimeout(() => {
        // Player gets first card
        setPlayerHand([data.player_cards[0]]);
        // Dealer gets up card only (hole card is hidden in backend)
        setDealerHand([data.dealer_up_card]);
        if (soundEnabled) cardSoundManager.playCardFlip();
      }, 300);

      setTimeout(() => {
        // Player gets second card
        setPlayerHand([data.player_cards[0], data.player_cards[1]]);
        if (soundEnabled) cardSoundManager.playCardFlip();
      }, 600);

      setTimeout(() => {
        // Show dealer has a face-down card (use placeholder)
        setDealerHand([data.dealer_up_card, 'BACK']);
        if (soundEnabled) cardSoundManager.playCardFlip();
        setPlayerScore(calculateBlackjackValue([data.player_cards[0], data.player_cards[1]]));
        
        // Check for immediate blackjack
        if (data.game_over) {
          // If game over immediately, get full dealer hand
          if (data.dealer_cards) {
            setDealerHand(data.dealer_cards);
          }
          handleGameEnd(data);
        } else {
          setCurrentGameState('PLAYER_TURN');
        }
      }, 900);

    } catch (error) {
      // console.error('Deal error:', error);
      setCurrentGameState('BETTING_OPEN');
    }
  };

  // Player actions - SIMPLIFIED HIT (matching STAND pattern)
  const hit = async () => {
    
    if (!sessionId || currentGameState !== 'PLAYER_TURN') {
      // console.error('❌ Cannot HIT - sessionId:', sessionId, 'state:', currentGameState);
      return;
    }

    try {
      if (soundEnabled) cardSoundManager.playCardFlip();
      
      const response = await fetch(`${API_URL}/api/blackjack/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action: 'hit'
        })
      });

      const data = await response.json();
      
      // Update player hand - new card will appear separately via animation
      setPlayerHand(data.player_cards);
      setPlayerScore(calculateBlackjackValue(data.player_cards));

      if (data.game_over) {
        setTimeout(() => handleGameEnd(data), 500);
      }
    } catch (error) {
      // console.error('❌ HIT ERROR:', error);
    }
  };

  const stand = async () => {
    if (!sessionId || currentGameState !== 'PLAYER_TURN') return;
    
    setCurrentGameState('DEALER_TURN');

    try {
      const response = await fetch(`${API_URL}/api/blackjack/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action: 'stand'
        })
      });

      const data = await response.json();
      
      // Immediately reveal dealer's full hand
      setDealerHand(data.dealer_cards);
      
      setTimeout(() => {
        setDealerScore(calculateBlackjackValue(data.dealer_cards));
        if (soundEnabled) cardSoundManager.playCardFlip();
      }, 300);

      setTimeout(() => {
        handleGameEnd(data);
      }, 800);

    } catch (error) {
      // console.error('Stand error:', error);
    }
  };

  const doubleDown = async () => {
    if (!sessionId || currentGameState !== 'PLAYER_TURN' || credits < currentBet) return;
    
    setCredits(credits - currentBet);
    setCurrentBet(currentBet * 2);
    
    if (soundEnabled) cardSoundManager.playCardFlip();

    try {
      const response = await fetch(`${API_URL}/api/blackjack/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action: 'double'
        })
      });

      const data = await response.json();
      setPlayerHand(data.player_cards);
      setPlayerScore(calculateBlackjackValue(data.player_cards));

      setTimeout(() => {
        setCurrentGameState('DEALER_TURN');
        setDealerHand(data.dealer_cards);
        setDealerScore(calculateBlackjackValue(data.dealer_cards));
      }, 600);

      setTimeout(() => {
        handleGameEnd(data);
      }, 1200);

    } catch (error) {
      // console.error('Double error:', error);
    }
  };

  // Split (basic - shows alert for now, can be expanded)
  const split = async () => {
    alert('Split functionality coming soon! For now, use HIT or STAND.');
    // TODO: Implement full split logic with backend support
  };

  // Handle game end
  const handleGameEnd = (data) => {
    
    // CRITICAL: Reveal all dealer cards first
    if (data.dealer_cards && data.dealer_cards.length > 0) {
      setDealerHand(data.dealer_cards);
      setDealerScore(calculateBlackjackValue(data.dealer_cards));
    }
    
    // Then show result
    setCurrentGameState('RESULT');
    
    const payout = data.payout || 0;
    const winAmount = payout - currentBet;
    
    
    // Determine winner
    let winner = data.winner;
    if (!winner) {
      // Calculate winner if not provided
      if (playerScore > 21) {
        winner = 'dealer';
      } else if (dealerScore > 21) {
        winner = 'player';
      } else if (playerScore > dealerScore) {
        winner = 'player';
      } else if (dealerScore > playerScore) {
        winner = 'dealer';
      } else {
        winner = 'push';
      }
    }
    
    setResult(winner);
    setLastWin(winAmount);
    
    
    // Add credits if won
    if (payout > 0) {
      setCredits(credits + payout);
      if (soundEnabled) cardSoundManager.playWinSound();
    } else if (winner === 'dealer') {
      if (soundEnabled) cardSoundManager.playLoseSound();
    }
  };

  // New round
  const newRound = () => {
    setCurrentGameState('BETTING_OPEN');
    setPlayerHand([]);
    setDealerHand([]);
    setPlayerScore(0);
    setDealerScore(0);
    setCurrentBet(0);
    setResult(null);
    setSessionId(null);
  };

  return (
    <CasinoTable3D gameType="blackjack">
      <ParticleEffectsOverlay />
      
      {/* Back Button */}
      <BackButton to="/games" label="Back to Games" variant="casino" />

      <div className="relative min-h-screen flex flex-col p-2">
        
        {/* TOP - Normal sized HUD */}
        <div className="flex justify-center gap-3 mb-2 relative z-20">
          <div className="px-4 py-1.5 rounded bg-black/40 backdrop-blur-xl border border-white/10">
            <div className="text-[10px] text-white/40 font-sans font-semibold tracking-wider">CREDITS</div>
            <div className="text-lg font-bold text-[#00F0FF] font-sans">{formatCurrency(credits)}</div>
          </div>
          <div className="px-4 py-1.5 rounded bg-black/40 backdrop-blur-xl border border-white/10">
            <div className="text-[10px] text-white/40 font-sans font-semibold tracking-wider">BET</div>
            <div className="text-lg font-bold text-[#FF003C] font-sans">{formatCurrency(currentBet)}</div>
          </div>
          <div className="px-4 py-1.5 rounded bg-black/40 backdrop-blur-xl border border-white/10">
            <div className="text-[10px] text-white/40 font-sans font-semibold tracking-wider">WIN</div>
            <div className="text-lg font-bold text-[#D4AF37] font-sans">{formatCurrency(lastWin)}</div>
          </div>
          
          {/* Sound toggle - slightly bigger */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="px-3 py-1.5 rounded bg-black/40 border border-white/10 text-base hover:bg-black/60 transition-all"
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
        </div>

        {/* Dealer message */}
        <div className="text-center mb-2">
          <div className="text-xs text-[#D4AF37] font-semibold">
            {currentGameState === 'BETTING_OPEN' ? 'Place your bet' :
             currentGameState === 'DEALING' ? 'Dealing...' :
             currentGameState === 'PLAYER_TURN' ? 'Your turn' :
             currentGameState === 'DEALER_TURN' ? 'Dealer playing...' :
             currentGameState === 'RESULT' ? (
               result === 'player' ? 'YOU WIN!' : 
               result === 'dealer' ? 'DEALER WINS' : 'PUSH'
             ) : ''}
          </div>
        </div>

        {/* CENTER - Cards - Very Compact */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 relative z-10">
          
          {/* Dealer Hand */}
          <div className="flex flex-col items-center gap-1">
            <div className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#D4AF37]">DEALER</div>
            <div className="flex gap-1">
              <AnimatePresence>
                {dealerHand.map((card, index) => {
                  
                  // Hole card is always index 1 during PLAYER_TURN
                  const isHoleCard = index === 1 && (currentGameState === 'BETTING_OPEN' || currentGameState === 'DEALING' || currentGameState === 'PLAYER_TURN');
                  const shouldShowFaceUp = !isHoleCard;
                  
                  // Parse the card 
                  const parsed = parseCard(card);
                  
                  return (
                    <motion.div
                      key={`dealer-${index}-${card}`}
                      initial={{ x: 0, y: -100, rotateY: 180, opacity: 0 }}
                      animate={{ 
                        x: 0, 
                        y: 0, 
                        rotateY: isHoleCard ? 180 : 0,
                        opacity: 1 
                      }}
                      transition={{ 
                        delay: index * 0.15,
                        duration: 0.5,
                        ease: CASINO_THEME.timing.easeOut as any
                      }}
                    >
                      <PlayingCard3D
                        value={parsed?.value}
                        suit={parsed?.suit}
                        faceUp={shouldShowFaceUp}
                        animate={false}
                        size="small"
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            {(currentGameState === 'DEALER_TURN' || currentGameState === 'RESULT') && dealerScore > 0 && (
              <div className="px-3 py-1 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]">
                <div className="text-sm font-black text-[#D4AF37]">{dealerScore}</div>
              </div>
            )}
          </div>

          {/* VS - Tiny */}
          <div className="px-2 py-0.5 rounded-full bg-black/60 border border-white/20">
            <div className="text-[10px] font-black text-white">VS</div>
          </div>

          {/* Player Hand */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex gap-1">
              <AnimatePresence>
                {playerHand.map((card, index) => {
                  const parsed = parseCard(card);
                  return parsed ? (
                    <motion.div
                      key={`player-${index}`}
                      initial={{ x: 0, y: 100, rotateY: 180, opacity: 0 }}
                      animate={{ x: 0, y: 0, rotateY: 0, opacity: 1 }}
                      transition={{ 
                        delay: index * 0.15,
                        duration: 0.4,
                        ease: CASINO_THEME.timing.easeOut as any
                      }}
                    >
                      <PlayingCard3D
                        value={parsed.value}
                        suit={parsed.suit}
                        faceUp={true}
                        animate={false}
                        size="small"
                      />
                    </motion.div>
                  ) : null;
                })}
              </AnimatePresence>
            </div>
            <div className="text-[10px] font-sans font-semibold uppercase tracking-wider text-[#00F0FF]">PLAYER</div>
            {playerScore > 0 && (
              <div className="px-3 py-1 rounded-full bg-[#00F0FF]/20 border border-[#00F0FF]">
                <div className="text-sm font-black text-[#00F0FF]">{playerScore}</div>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM - Compact Betting/Actions */}
        <div className="relative z-20 pb-2">
          
          {/* BETTING PHASE - BET ZONE */}
          {currentGameState === 'BETTING_OPEN' && (
            <div className="flex flex-col items-center gap-3">
              
              {/* Small Tap to Bet area - centered between 50 and 100 */}
              <div className="text-center">
                <div 
                  onClick={placeBet}
                  className="inline-block px-6 py-2 rounded-lg border-2 border-dashed border-[#D4AF37]/60 cursor-pointer
                    hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all bg-black/20"
                >
                  <div className="text-[#D4AF37] text-xs font-bold">TAP TO BET</div>
                  {currentBet > 0 && (
                    <div className="text-white text-sm font-black">${currentBet}</div>
                  )}
                </div>
              </div>

              {/* Chips row */}
              <div className="flex justify-center gap-3 items-center">
                {chipValues.map((value) => (
                  <div
                    key={value}
                    onClick={() => setChipValue(value)}
                    className={`cursor-pointer transition-all duration-300 ${
                      chipValue === value 
                        ? 'ring-2 ring-[#D4AF37] drop-shadow-[0_0_15px_rgba(212,175,55,1)] scale-110' 
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white/20 shadow-lg"
                      style={{
                        background: value >= 500 
                          ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' 
                          : value >= 100 
                          ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                          : value >= 50
                          ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                          : 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                      }}
                    >
                      <span className="text-white drop-shadow">${value}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Buttons below chips */}
              <div className="flex gap-3">
                <button
                  onClick={clearBet}
                  disabled={currentBet === 0}
                  className="px-6 py-2 bg-transparent border border-[#FF003C] text-[#FF003C] font-sans font-bold text-xs 
                    uppercase hover:bg-[#FF003C] hover:text-white transition-all 
                    disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  CLEAR
                </button>

                <button
                  onClick={deal}
                  disabled={currentBet === 0}
                  className="px-8 py-2 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-sans font-black text-xs 
                    uppercase hover:shadow-[0_0_20px_rgba(212,175,55,0.6)] transition-all 
                    disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  DEAL
                </button>
              </div>
            </div>
          )}

          {/* PLAYING PHASE - ULTRA SIMPLE BUTTONS */}
          {currentGameState === 'PLAYER_TURN' && (
            <div className="flex justify-center gap-3 flex-wrap" style={{ position: 'relative', zIndex: 9999 }}>
              <button
                type="button"
                onClick={() => {
                  hit(); 
                }}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#00F0FF',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  pointerEvents: 'auto'
                }}
              >
                HIT
              </button>

              <button
                type="button"
                onClick={() => {
                  stand(); 
                }}
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#FF003C',
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  pointerEvents: 'auto'
                }}
              >
                STAND
              </button>

              {playerHand.length === 2 && credits >= currentBet && (
                <button
                  type="button"
                  onClick={() => {
                    doubleDown(); 
                  }}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#D4AF37',
                    color: '#000',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    pointerEvents: 'auto'
                  }}
                >
                  DOUBLE
                </button>
              )}
            </div>
          )}

          {/* RESULT PHASE - Clear Winner Announcement */}
          {currentGameState === 'RESULT' && (
            <div className="flex flex-col items-center gap-3">
              <div className={`px-10 py-4 rounded-xl border-2 shadow-2xl ${
                result === 'player' 
                  ? 'bg-[#00F0FF]/30 border-[#00F0FF] shadow-[#00F0FF]/50' 
                  : result === 'dealer'
                  ? 'bg-[#FF003C]/30 border-[#FF003C] shadow-[#FF003C]/50'
                  : 'bg-white/30 border-white shadow-white/50'
              }`}>
                <div className={`text-3xl font-black uppercase text-center ${
                  result === 'player' ? 'text-[#00F0FF]' : 
                  result === 'dealer' ? 'text-[#FF003C]' : 'text-white'
                }`}>
                  {result === 'player' ? '🎉 YOU WIN! 🎉' : 
                   result === 'dealer' ? '😔 DEALER WINS' : '🤝 PUSH'}
                </div>
                <div className="text-center mt-2 text-white/80 text-sm">
                  Player: {playerScore} | Dealer: {dealerScore}
                </div>
                {lastWin !== 0 && (
                  <div className={`text-xl font-bold text-center mt-2 ${
                    lastWin > 0 ? 'text-[#D4AF37]' : 'text-[#FF003C]'
                  }`}>
                    {lastWin > 0 ? '+' : ''}{formatCurrency(lastWin)}
                  </div>
                )}
              </div>

              <button
                onClick={newRound}
                className="px-10 py-2.5 bg-gradient-to-r from-[#D4AF37] to-[#FFD700] text-black font-sans font-black text-sm 
                  uppercase hover:shadow-[0_0_25px_rgba(212,175,55,0.8)] transition-all active:scale-95"
              >
                NEW ROUND
              </button>
            </div>
          )}
        </div>
      </div>
    </CasinoTable3D>
  );
}
