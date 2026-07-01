
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { Settings } from 'lucide-react';

// Import all casino table layouts
import ClassicCasinoTable from '../casino/ClassicCasinoTable';
import CyberpunkNeonTable from '../casino/CyberpunkNeonTable';
import VIPLuxuryTable from '../casino/VIPLuxuryTable';
import MinimalistTable from '../casino/MinimalistTable';
import TableStyleSelector from '../casino/TableStyleSelector';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
export function PracticeBlackjack({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const playerHand = game.game_state?.player_hand || [];
  const dealerHand = game.game_state?.dealer_hand || [];
  const playerScore = game.game_state?.player_score || 0;
  const dealerScore = game.game_state?.dealer_score || 0;
  const playerBalance = game.game_state?.player_balance || 1000;
  const currentBet = game.game_state?.current_bet || 0;
  const cardCount = game.game_state?.card_count || 0;
  
  const [gameResult, setGameResult] = useState(null);
  const [selectedTable, setSelectedTable] = useState('classic'); // classic, cyberpunk, vip, minimalist
  const [selectedCardStyle, setSelectedCardStyle] = useState('realistic');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [winStreak, setWinStreak] = useState(0);
  const [lossStreak, setLossStreak] = useState(0);
  const [dealerPhrase, setDealerPhrase] = useState('welcome');
  const [dealerMood, setDealerMood] = useState('professional');
  const [isDealing, setIsDealing] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(0);
  
  const { width, height } = useWindowSize();
  
  const gameOver = game.status === 'completed';
  const playerWon = gameOver && game.winner === 'player';
  const gamePhase = gameOver ? 'finished' : (playerHand.length === 0 ? 'betting' : 'playing');

  // Update dealer phrases based on game state
  useEffect(() => {
    if (gameOver) {
      if (game.winner === 'player') {
        cardSoundManager.playWinSound();
        setParticleTrigger(prev => prev + 1);
        if (playerScore === 21 && playerHand.length === 2) {
          setDealerPhrase('bigWin');
          setDealerMood('excited');
        } else {
          setDealerPhrase('playerWins');
          setDealerMood('happy');
        }
      } else if (game.winner === 'dealer') {
        cardSoundManager.playLoseSound();
        setDealerPhrase('playerLoses');
        setDealerMood('professional');
      }
    } else if (playerHand.length > 0) {
      setDealerPhrase('playerTurn');
      setDealerMood('neutral');
    }
  }, [gameOver, game.winner, playerScore, playerHand]);

  // Track dealing animation
  useEffect(() => {
    if (playerHand.length > 0 && !gameOver) {
      setIsDealing(true);
      const timer = setTimeout(() => setIsDealing(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [playerHand.length, gameOver]);

  // Update streaks
  useEffect(() => {
    if (gameOver) {
      if (game.winner === 'player') {
        if (playerScore === 21 && playerHand.length === 2) {
          setGameResult({ type: 'win', message: 'BLACKJACK! 🎰', payout: currentBet * 2.5 });
        } else {
          setGameResult({ type: 'win', message: 'You Win! 🎉', payout: currentBet * 2 });
        }
        setWinStreak(prev => prev + 1);
        setLossStreak(0);
      } else if (game.winner === 'dealer') {
        setGameResult({ type: 'lose', message: 'Dealer Wins', payout: 0 });
        setLossStreak(prev => prev + 1);
        setWinStreak(0);
      } else {
        setGameResult({ type: 'draw', message: 'Push!', payout: currentBet });
        // Don't update streaks on push
      }
    }
  }, [gameOver, game.winner, playerScore, playerHand, currentBet]);

  const handleHit = () => {
    cardSoundManager.playCardDeal();
    setDealerPhrase('dealing');
    setDealerMood('professional');
    onMove({ action: 'hit' });
  };

  const handleStand = () => {
    setDealerPhrase('noMoreBets');
    setDealerMood('professional');
    onMove({ action: 'stand' });
  };

  const handleDouble = () => {
    setDealerPhrase('riskyMove');
    setDealerMood('excited');
    onMove({ action: 'double' });
  };

  const handleTipDealer = () => {
    // TODO: Implement tip functionality
    setDealerPhrase('playerWins');
    setDealerMood('happy');
    alert('Thanks for the tip! 💰');
  };

  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
  };

  // Format cards for PlayingCard component
  const formatCard = (card) => {
    if (!card) return 'BACK';
    // Convert "10H" format to proper format
    return card;
  };

  // Render appropriate table layout
  const renderTable = () => {
    const tableProps = {
      balance: playerBalance,
      currentBet,
      dealerCards: dealerHand.map(formatCard),
      playerCards: playerHand.map(formatCard),
      dealerScore,
      playerScore,
      dealerPhrase,
      dealerMood,
      isDealing,
      isShuffling: false,
      onHit: handleHit,
      onStand: handleStand,
      onDouble: handleDouble,
      onTipDealer: handleTipDealer,
      soundEnabled,
      onToggleSound: toggleSound,
      cardStyle: selectedCardStyle,
      cardCount,
      winStreak,
      lossStreak,
      gamePhase,
      disabled: makingMove || aiThinking || gameOver
    };

    switch (selectedTable) {
      case 'cyberpunk':
        return <CyberpunkNeonTable {...tableProps} />;
      case 'vip':
        return <VIPLuxuryTable {...tableProps} />;
      case 'minimalist':
        return <MinimalistTable {...tableProps} />;
      case 'classic':
      default:
        return <ClassicCasinoTable {...tableProps} />;
    }
  };

  return (
    <>
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      {/* Victory Confetti */}
      {playerWon && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          colors={['#fbbf24', '#f59e0b', '#d97706', '#b45309']}
        />
      )}

      {/* Table Layout */}
      {renderTable()}

      {/* Settings Button (Floating) */}
      <motion.button
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowSettings(true)}
        className="fixed bottom-24 left-6 z-50 p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-full shadow-2xl shadow-purple-500/50 border-2 border-white/20"
      >
        <Settings className="w-6 h-6 text-white" />
      </motion.button>

      {/* Table & Card Style Selector */}
      <TableStyleSelector
        currentTable={selectedTable}
        currentCardStyle={selectedCardStyle}
        onTableChange={setSelectedTable}
        onCardStyleChange={setSelectedCardStyle}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Game Result Overlay */}
      <AnimatePresence>
        {gameResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setGameResult(null)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-center px-8"
            >
              {/* Result Icon */}
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-9xl mb-6"
              >
                {gameResult.type === 'win' ? '💰' : gameResult.type === 'lose' ? '😔' : '🤝'}
              </motion.div>
              
              {/* Result Message */}
              <h3 className={`text-6xl font-black mb-4 ${
                gameResult.type === 'win' 
                  ? 'text-transparent bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text' 
                  : gameResult.type === 'lose'
                  ? 'text-transparent bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text'
                  : 'text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text'
              }`}>
                {gameResult.message}
              </h3>
              
              {/* Scores */}
              <div className="bg-black/60 backdrop-blur-md px-8 py-4 rounded-2xl border-2 border-yellow-500/50 mb-4">
                <p className="text-yellow-400 text-3xl font-black mb-2">
                  You: {playerScore} | Dealer: {dealerScore}
                </p>
                {gameResult.payout > 0 && (
                  <p className="text-green-400 text-2xl font-bold">
                    +${gameResult.payout}
                  </p>
                )}
              </div>

              {/* Streak Indicator */}
              {winStreak > 1 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-full text-xl font-bold"
                >
                  🔥 {winStreak} Win Streak!
                </motion.div>
              )}

              {/* Click to continue */}
              <motion.p
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-white/60 text-sm mt-6"
              >
                Click anywhere to continue
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      {(makingMove || aiThinking) && !gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="text-6xl"
          >
            🎰
          </motion.div>
        </div>
      )}
    </>
  );
}
