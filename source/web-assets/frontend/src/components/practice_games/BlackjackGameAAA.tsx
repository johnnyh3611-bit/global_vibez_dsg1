
/**
 * @deprecated Use BlackjackGameSimple (route: /practice/play/blackjack) or the
 * Universal Engine Blackjack Plugin (route: /game/blackjack/:roomCode) instead.
 * This component is retained for backward-compatibility of bookmarked URLs
 * (/practice/play/blackjack-aaa) and will be archived in a future release.
 * See /app/LEGACY_DEPRECATION_PLAN.md for the migration schedule.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import BackButton from '@/components/BackButton';
import { AAACard } from '@/components/casino/AAACard';
import SideBetArea from '@/components/casino/SideBetArea';
import LightningEffect from '@/components/effects/LightningEffect';
import { soundManager } from '@/sounds/blackjack-sounds';
import { LOUNGE } from './blackjack/loungeTheme';


const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function BlackjackGameAAA() {
  // Game State
  const [sessionId, setSessionId] = useState(null);
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [playerValue, setPlayerValue] = useState(0);
  const [dealerValue, setDealerValue] = useState(0);
  const [dealerHoleCardHidden, setDealerHoleCardHidden] = useState(true);
  
  // Betting State
  const [balance, setBalance] = useState(5000);
  const [currentBet, setCurrentBet] = useState(0);
  const [selectedChip, setSelectedChip] = useState(100);
  const [sideBets, setSideBets] = useState<Record<string, number>>({});
  
  // Lightning State
  const [lightningActive, setLightningActive] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [showLightning, setShowLightning] = useState(false);
  
  // Side Bet Results
  interface BlackjackSideBetResult {
    win?: boolean;
    multiplier?: number;
    type?: string;
    payout?: number;
    [k: string]: any;
  }
  const [sideBetResults, setSideBetResults] = useState<Record<string, BlackjackSideBetResult>>({});
  
  // Insurance
  const [insuranceOffered, setInsuranceOffered] = useState(false);
  const [insuranceTaken, setInsuranceTaken] = useState(false);
  
  // Split
  const [canSplit, setCanSplit] = useState(false);
  
  // Game Flow
  const [gamePhase, setGamePhase] = useState('betting'); // betting, playing, insurance, finished
  const [winner, setWinner] = useState(null);
  const [payout, setPayout] = useState(0);
  const [isDealing, setIsDealing] = useState(false);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  
  // Celebrations
  const [showConfetti, setShowConfetti] = useState(false);
  const [resultMessage, setResultMessage] = useState('');
  
  const { width, height } = useWindowSize();
  
  const chipValues = [25, 100, 500, 1000, 5000];

  // Parse card string
  const parseCard = (cardStr) => {
    if (!cardStr || typeof cardStr !== 'string' || cardStr === 'BACK') return null;
    const rank = cardStr.slice(0, -1);
    const suitCode = cardStr.slice(-1).toUpperCase();
    const suitMap = { 'H': 'hearts', 'D': 'diamonds', 'C': 'clubs', 'S': 'spades' };
    return { rank, suit: suitMap[suitCode] || 'spades' };
  };

  // Chip Selection
  const handleChipClick = (value) => {
    setSelectedChip(value);
    soundManager.playChipPlace();
  };

  // Place Bet
  const handlePlaceBet = () => {
    if (currentBet + selectedChip <= balance) {
      setCurrentBet(currentBet + selectedChip);
      soundManager.playChipPlace();
    }
  };

  // Clear Bet
  const handleClearBet = () => {
    setCurrentBet(0);
    setSideBets({});
  };

  // Toggle Lightning
  const handleLightningToggle = () => {
    setLightningActive(!lightningActive);
  };

  // Deal Initial Hand
  const handleDeal = async () => {
    if (currentBet === 0) {
      alert('Please place a bet first!');
      return;
    }
    
    const totalBet = currentBet + (sideBets.perfect_pairs || 0) + (sideBets['21_plus_3'] || 0);
    if (totalBet > balance) {
      alert('Insufficient balance!');
      return;
    }
    
    setIsDealing(true);
    setGamePhase('playing');
    setWinner(null);
    setResultMessage('');
    setSideBetResults({});
    setInsuranceOffered(false);
    setInsuranceTaken(false);
    setCurrentMultiplier(1);
    
    try {
      const response = await fetch(`${API_URL}/api/blackjack/deal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: 'player_1',
          bet_amount: currentBet,
          side_bets: sideBets,
          lightning_active: lightningActive,
          client_seed: Math.random().toString(36).substring(7)
        })
      });
      
      const data = await response.json();
      
      // Deal cards with animation delay
      setTimeout(() => soundManager.playCardDeal(), 100);
      setTimeout(() => soundManager.playCardDeal(), 300);
      setTimeout(() => soundManager.playCardDeal(), 500);
      setTimeout(() => soundManager.playCardDeal(), 700);
      
      setSessionId(data.session_id);
      setPlayerCards(data.player_cards);
      setDealerCards([data.dealer_up_card, 'BACK']);
      setPlayerValue(data.player_value);
      setDealerValue(data.dealer_showing);
      setDealerHoleCardHidden(true);
      setCanSplit(data.can_split || false);
      
      // Handle side bet results
      if (data.side_bet_results) {
        setSideBetResults(data.side_bet_results);
        (Object.values(data.side_bet_results) as BlackjackSideBetResult[]).forEach((result) => {
          if (result.win) {
            setTimeout(() => soundManager.playSideBetWin(result.multiplier), 1000);
          }
        });
      }
      
      // Handle lightning multiplier
      if (data.lightning_multiplier && data.lightning_multiplier > 1) {
        setCurrentMultiplier(data.lightning_multiplier);
        setTimeout(() => {
          setShowLightning(true);
          soundManager.playLightning();
          setTimeout(() => setShowLightning(false), 2000);
        }, 1000);
      }
      
      // Check for insurance offer
      if (data.offer_insurance) {
        setInsuranceOffered(true);
        setGamePhase('insurance');
      }
      
      // Check for immediate blackjack
      if (data.game_over) {
        setTimeout(() => handleGameEnd(data), 1500);
      }
      
      setIsDealing(false);
    } catch (error) {
      // console.error('Deal error:', error);
      setIsDealing(false);
      setGamePhase('betting');
    }
  };

  // Handle Insurance Decision
  const handleInsurance = async (takesInsurance) => {
    setInsuranceTaken(takesInsurance);
    setInsuranceOffered(false);
    setGamePhase('playing');
    
    if (takesInsurance) {
      // Deduct insurance bet (half of main bet)
      const insuranceBet = currentBet / 2;
      setBalance(balance - insuranceBet);
    }
  };

  // Player Actions
  const handleAction = async (action) => {
    if (!sessionId || isActionInProgress) return;
    
    setIsActionInProgress(true);
    
    try {
      const response = await fetch(`${API_URL}/api/blackjack/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          action: action
        })
      });
      
      const data = await response.json();
      
      // Play sound for action
      if (action === 'hit' || action === 'double') {
        soundManager.playCardDeal();
      }
      
      // Update player cards if hit or double
      if (data.player_cards) {
        setPlayerCards(data.player_cards);
        setPlayerValue(data.player_value);
      }
      
      // If game over, reveal dealer cards
      if (data.game_over) {
        if (data.dealer_cards) {
          setDealerCards(data.dealer_cards);
          setDealerValue(data.dealer_value);
          // Animate dealer card flip
          setTimeout(() => {
            soundManager.playCardDeal();
            setDealerHoleCardHidden(false);
          }, 500);
        }
        setTimeout(() => handleGameEnd(data), 1000);
      }
      
      setIsActionInProgress(false);
    } catch (error) {
      // console.error('Action error:', error);
      setIsActionInProgress(false);
    }
  };

  // Handle Game End
  const handleGameEnd = (data) => {
    setGamePhase('finished');
    setWinner(data.winner);
    
    // Calculate payout with lightning multiplier
    let finalPayout = data.payout || 0;
    if (lightningActive && currentMultiplier > 1 && data.winner === 'player') {
      finalPayout = (data.payout || 0) * currentMultiplier;
    }
    
    setPayout(finalPayout);
    
    // Update balance
    if (finalPayout > 0) {
      setBalance(balance - currentBet + finalPayout);
    } else if (data.winner === 'dealer') {
      setBalance(balance - currentBet);
    }
    
    // Set result message and play sounds
    if (data.winner === 'player') {
      if (data.is_blackjack) {
        setResultMessage(`🃏 BLACKJACK! ${currentMultiplier > 1 ? `${currentMultiplier}X!` : ''} 🃏`);
        soundManager.playWin(true);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      } else {
        setResultMessage(`🎉 YOU WIN! ${currentMultiplier > 1 ? `${currentMultiplier}X!` : ''} 🎉`);
        soundManager.playWin(false);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    } else if (data.winner === 'dealer') {
      setResultMessage(data.result === 'bust' ? '💥 BUST!' : '😔 Dealer Wins');
      soundManager.playLoss();
    } else if (data.winner === 'push') {
      setResultMessage('🤝 PUSH');
    }
  };

  // New Round
  const handleNewRound = () => {
    setGamePhase('betting');
    setPlayerCards([]);
    setDealerCards([]);
    setPlayerValue(0);
    setDealerValue(0);
    setCurrentBet(0);
    setSideBets({});
    setSessionId(null);
    setWinner(null);
    setPayout(0);
    setResultMessage('');
    setSideBetResults({});
    setCurrentMultiplier(1);
    setCanSplit(false);
  };

  // Get hand value color
  const getValueColor = (value, isBust = false) => {
    if (isBust || value > 21) return 'text-red-500';
    if (value === 21) return 'text-yellow-400';
    if (value >= 17) return 'text-orange-400';
    return 'text-green-400';
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden"
      style={{ background: LOUNGE.roomBg }}
    >
      
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={400}
          colors={['#fbbf24', '#f59e0b', '#d97706', '#22c55e', '#a855f7']}
        />
      )}
      
      {/* Lightning Effect */}
      <AnimatePresence>
        <LightningEffect multiplier={currentMultiplier} show={showLightning} />
      </AnimatePresence>
      
      {/* Back Button */}
      <BackButton />
      
      {/* Ambient Glow (warm amber + burgundy) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px]"
          style={{ background: 'rgba(212, 175, 55, 0.14)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[120px]"
          style={{ background: 'rgba(107, 26, 26, 0.18)' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: LOUNGE.spotlightBg }}
        />
      </div>
      
      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-between p-4 md:p-8">
        
        {/* Header */}
        <div className="w-full max-w-6xl flex justify-between items-center mb-4">
          <div
            className="backdrop-blur-sm rounded-2xl px-6 py-3 shadow-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(212,175,55,0.18) 0%, rgba(140,109,24,0.22) 100%)',
              border: `1px solid ${LOUNGE.goldDark}`,
            }}
          >
            <div
              className="text-xs uppercase tracking-[0.25em]"
              style={{ color: '#c8a875', fontFamily: LOUNGE.fontBody }}
            >
              Balance
            </div>
            <div
              className="text-2xl font-black tabular-nums"
              style={{ color: LOUNGE.goldLight, fontFamily: LOUNGE.fontDisplay }}
            >
              ${balance.toLocaleString()}
            </div>
          </div>

          <div className="text-center">
            <h1
              className="text-4xl md:text-5xl font-black tracking-wider"
              style={{
                backgroundImage: LOUNGE.goldGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontFamily: LOUNGE.fontDisplay,
              }}
            >
              BLACKJACK AAA+
            </h1>
            <div
              className="text-[10px] uppercase tracking-[0.3em] mt-1"
              style={{ color: '#8c7555', fontFamily: LOUNGE.fontBody }}
            >
              Premium Casino
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div
              className="backdrop-blur-sm rounded-2xl px-6 py-3 shadow-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(107,26,26,0.28) 0%, rgba(74,16,16,0.35) 100%)',
                border: `1px solid ${LOUNGE.goldDark}`,
              }}
            >
              <div
                className="text-xs uppercase tracking-[0.25em]"
                style={{ color: '#c8a875', fontFamily: LOUNGE.fontBody }}
              >
                Bet
              </div>
              <div
                className="text-2xl font-black tabular-nums"
                style={{ color: LOUNGE.goldLight, fontFamily: LOUNGE.fontDisplay }}
              >
                ${currentBet}
              </div>
            </div>

            {/* Lightning Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleLightningToggle}
              className="px-4 py-2 rounded-xl font-bold text-sm shadow-lg transition-all"
              style={
                lightningActive
                  ? {
                      background: LOUNGE.goldGradient,
                      color: '#1a0f08',
                      boxShadow: LOUNGE.shadow.glow,
                      fontFamily: LOUNGE.fontBody,
                    }
                  : {
                      background: LOUNGE.bg.charcoal,
                      color: '#9ca3af',
                      border: `1px solid ${LOUNGE.goldDark}`,
                      fontFamily: LOUNGE.fontBody,
                    }
              }
            >
              ⚡ Lightning {lightningActive ? 'ON' : 'OFF'}
            </motion.button>
          </div>
        </div>
        
        {/* Playing Area */}
        <div className="flex-1 w-full max-w-6xl flex flex-col justify-center items-center gap-8">
          
          {/* Dealer Section */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                🎩 Dealer
              </div>
              <div className={`text-3xl font-black ${getValueColor(dealerValue, dealerValue > 21 && !dealerHoleCardHidden)}`}>
                {dealerHoleCardHidden && gamePhase !== 'finished' ? '?' : dealerValue}
              </div>
            </div>
            
            {/* Dealer Cards */}
            <div className="flex gap-3">
              <AnimatePresence>
                {dealerCards.map((card, index) => {
                  const parsed = card === 'BACK' ? null : parseCard(card);
                  return (
                    <motion.div
                      key={`dealer-${index}`}
                      initial={{ y: -200, opacity: 0, rotateY: 180 }}
                      animate={{ y: 0, opacity: 1, rotateY: 0 }}
                      transition={{ delay: index * 0.2 + 0.4, duration: 0.5, type: 'spring' }}
                    >
                      <AAACard
                        card={parsed}
                        faceDown={card === 'BACK' || (index === 1 && dealerHoleCardHidden)}
                        size="lg"
                        glowColor={parsed && dealerValue === 21 && !dealerHoleCardHidden ? '#fbbf24' : null}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
          
          {/* Side Bet Results Display */}
          {Object.keys(sideBetResults).length > 0 && (
            <div className="flex gap-4">
              {sideBetResults.perfect_pairs && sideBetResults.perfect_pairs.win && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-purple-500/20 border-2 border-purple-400 rounded-xl px-6 py-3 backdrop-blur-sm"
                >
                  <div className="text-purple-300 font-bold text-sm">Perfect Pairs!</div>
                  <div className="text-purple-100 text-lg font-black">{sideBetResults.perfect_pairs.type}</div>
                  <div className="text-green-400 text-xl font-black">+${sideBetResults.perfect_pairs.payout}</div>
                </motion.div>
              )}
              {sideBetResults['21_plus_3'] && sideBetResults['21_plus_3'].win && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-blue-500/20 border-2 border-blue-400 rounded-xl px-6 py-3 backdrop-blur-sm"
                >
                  <div className="text-blue-300 font-bold text-sm">21+3!</div>
                  <div className="text-blue-100 text-lg font-black">{sideBetResults['21_plus_3'].type}</div>
                  <div className="text-green-400 text-xl font-black">+${sideBetResults['21_plus_3'].payout}</div>
                </motion.div>
              )}
            </div>
          )}
          
          {/* Result Message */}
          {resultMessage && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 10 }}
              className="text-5xl md:text-6xl font-black text-center"
              style={{
                textShadow: '0 0 30px rgba(251, 191, 36, 0.8)',
                color: winner === 'player' ? '#fbbf24' : winner === 'dealer' ? '#ef4444' : '#3b82f6'
              }}
            >
              {resultMessage}
            </motion.div>
          )}
          
          {/* Insurance Prompt */}
          {insuranceOffered && gamePhase === 'insurance' && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-blue-500/20 border-2 border-blue-400 rounded-xl p-6 backdrop-blur-sm"
            >
              <div className="text-center mb-4">
                <div className="text-blue-300 font-bold text-lg">Insurance?</div>
                <div className="text-sm text-gray-400">Dealer showing Ace</div>
                <div className="text-blue-200 text-sm mt-1">Costs ${currentBet / 2} • Pays 2:1 if dealer has Blackjack</div>
              </div>
              <div className="flex gap-4 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleInsurance(true)}
                  className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-bold text-white"
                >
                  YES
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleInsurance(false)}
                  className="px-8 py-3 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl font-bold text-white"
                >
                  NO
                </motion.button>
              </div>
            </motion.div>
          )}
          
          {/* Player Section */}
          <div className="flex flex-col items-center gap-4">
            {/* Player Cards */}
            <div className="flex gap-3">
              <AnimatePresence>
                {playerCards.map((card, index) => {
                  const parsed = parseCard(card);
                  return (
                    <motion.div
                      key={`player-${index}`}
                      initial={{ y: 200, opacity: 0, rotateY: 180 }}
                      animate={{ y: 0, opacity: 1, rotateY: 0 }}
                      transition={{ delay: index * 0.2, duration: 0.5, type: 'spring' }}
                    >
                      <AAACard
                        card={parsed}
                        size="lg"
                        glowColor={playerValue === 21 ? '#22c55e' : null}
                      />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                💎 Player
              </div>
              <div className={`text-3xl font-black ${getValueColor(playerValue, playerValue > 21)}`}>
                {playerValue}
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Area */}
        <div className="w-full max-w-4xl mb-4">
          
          {/* Betting Phase */}
          {gamePhase === 'betting' && (
            <div className="flex flex-col gap-4">
              {/* Side Bets */}
              <SideBetArea
                sideBets={sideBets}
                setSideBets={setSideBets}
                selectedChip={selectedChip}
                balance={balance}
              />
              
              {/* Chip Selection */}
              <div className="flex justify-center gap-3 flex-wrap">
                {chipValues.map((value) => (
                  <motion.button
                    key={value}
                    whileHover={{ scale: 1.1, y: -5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleChipClick(value)}
                    className={`relative w-16 h-16 rounded-full font-black text-sm transition-all ${
                      selectedChip === value
                        ? 'ring-4 ring-yellow-400 shadow-xl shadow-yellow-400/50'
                        : 'ring-2 ring-white/20'
                    }`}
                    style={{
                      background: value >= 1000 
                        ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' 
                        : value >= 500 
                        ? 'linear-gradient(135deg, #8b5cf6, #6366f1)' 
                        : value >= 100 
                        ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                        : 'linear-gradient(135deg, #22c55e, #16a34a)'
                    }}
                  >
                    ${value}
                  </motion.button>
                ))}
              </div>
              
              {/* Betting Buttons */}
              <div className="flex justify-center gap-4 flex-wrap">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handlePlaceBet}
                  className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-bold text-white shadow-lg"
                >
                  Place Bet
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClearBet}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 rounded-xl font-bold text-white shadow-lg"
                >
                  Clear
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDeal}
                  disabled={currentBet === 0 || isDealing}
                  className="px-10 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl font-black text-white shadow-xl shadow-yellow-500/50 disabled:opacity-50 text-lg"
                >
                  {isDealing ? 'Dealing...' : 'DEAL'}
                </motion.button>
              </div>
            </div>
          )}
          
          {/* Playing Phase */}
          {gamePhase === 'playing' && (
            <div className="flex justify-center gap-3 flex-wrap">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction('hit')}
                disabled={isActionInProgress}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl font-black text-white shadow-xl disabled:opacity-50"
              >
                HIT
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAction('stand')}
                disabled={isActionInProgress}
                className="px-8 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl font-black text-white shadow-xl disabled:opacity-50"
              >
                STAND
              </motion.button>
              
              {playerCards.length === 2 && balance >= currentBet * 2 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAction('double')}
                  disabled={isActionInProgress}
                  className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl font-black text-white shadow-xl disabled:opacity-50"
                >
                  DOUBLE
                </motion.button>
              )}
              
              {canSplit && balance >= currentBet * 2 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAction('split')}
                  disabled={isActionInProgress}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl font-black text-white shadow-xl disabled:opacity-50"
                >
                  SPLIT
                </motion.button>
              )}
            </div>
          )}
          
          {/* Finished Phase */}
          {gamePhase === 'finished' && (
            <div className="flex flex-col items-center gap-4">
              {payout > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-black text-green-400"
                >
                  + ${payout.toLocaleString()}
                </motion.div>
              )}
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNewRound}
                className="px-12 py-4 bg-gradient-to-r from-yellow-500 to-orange-600 rounded-xl font-black text-white shadow-xl shadow-yellow-500/50 text-lg"
              >
                NEW ROUND
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
