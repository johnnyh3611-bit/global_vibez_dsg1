
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { Settings } from 'lucide-react';

// Import casino table layouts
import ClassicCasinoTable from '../casino/ClassicCasinoTable';
import CyberpunkNeonTable from '../casino/CyberpunkNeonTable';
import VIPLuxuryTable from '../casino/VIPLuxuryTable';
import MinimalistTable from '../casino/MinimalistTable';
import TableStyleSelector from '../casino/TableStyleSelector';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
export function PracticeSpades({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const playerHand = game.game_state?.player_hand || [];
  const currentTrick = game.game_state?.current_trick || [];
  const playerBid = game.game_state?.player_bid || 0;
  const playerTricks = game.game_state?.player_tricks || 0;
  const aiBid = game.game_state?.ai_bid || 0;
  const aiTricks = game.game_state?.ai_tricks || 0;
  const playerScore = game.game_state?.player_score || 0;
  const aiScore = game.game_state?.ai_score || 0;
  const [gameResult, setGameResult] = useState(null);
  
  // Casino table settings
  const [selectedTable, setSelectedTable] = useState('classic');
  const [selectedCardStyle, setSelectedCardStyle] = useState('realistic');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [dealerPhrase, setDealerPhrase] = useState('welcome');
  const [dealerMood, setDealerMood] = useState('professional');
  const [isDealing, setIsDealing] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  
  const { width, height } = useWindowSize();
  
  const gameOver = game.status === 'completed';
  const playerWon = gameOver && game.winner === 'player';

  useEffect(() => {
    if (gameOver) {
      if (game.winner === 'player') {
        cardSoundManager.playWinSound(); // AAA Card Juice
        setGameResult({ type: 'win', message: 'Victory! 🎉' });
        setDealerPhrase('bigWin');
        setDealerMood('excited');
        setIsCelebrating(true);
        setTimeout(() => setIsCelebrating(false), 3000);
      } else {
        setGameResult({ type: 'lose', message: 'AI Wins!' });
        setDealerPhrase('playerLoses');
        setDealerMood('professional');
      }
    }
  }, [gameOver, game.winner]);

  const handleCardClick = (card) => {
    if (!gameOver && !makingMove && !aiThinking && game.current_turn === 'player') {
      cardSoundManager.playCardFlip(); // AAA Card Juice
      onMove({ card });
      setIsDealing(true);
      setDealerPhrase('dealing');
      setTimeout(() => setIsDealing(false), 1000);
    }
  };

  const handleBid = (bid) => {
    cardSoundManager.playCardSlam(); // AAA Card Juice
    onMove({ action: 'bid', amount: bid });
    setDealerPhrase('goodMove');
    setDealerMood('professional');
  };

  const playerCards = playerHand.map(card => card);
  const dealerCards = currentTrick.map(t => t.card);

  const renderTable = () => {
    const tableProps = {
      balance: 1000,
      currentBet: 0,
      dealerCards,
      playerCards,
      dealerScore: aiScore,
      playerScore,
      dealerPhrase,
      dealerMood,
      isDealing,
      isShuffling: false,
      isCelebrating,
      onHit: null,
      onStand: null,
      onDouble: null,
      soundEnabled,
      onToggleSound: () => setSoundEnabled(!soundEnabled),
      cardStyle: selectedCardStyle,
      cardCount: 0,
      winStreak: 0,
      lossStreak: 0,
      gamePhase: gameOver ? 'finished' : 'playing',
      disabled: makingMove || aiThinking || gameOver,
      children: (
        <div className="space-y-6">
          {/* Score Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-blue-400">
              <p className="text-blue-200 text-sm">Your Score</p>
              <p className="text-white text-3xl font-bold">{playerScore} ♠️</p>
              <p className="text-blue-300 text-sm mt-2">Bid: {playerBid} | Tricks: {playerTricks}</p>
            </div>
            <div className="bg-purple-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-purple-400">
              <p className="text-purple-200 text-sm">AI Score</p>
              <p className="text-white text-3xl font-bold">{aiScore} ♠️</p>
              <p className="text-purple-300 text-sm mt-2">Bid: {aiBid} | Tricks: {aiTricks}</p>
            </div>
          </div>

          {/* Game Info */}
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block bg-black/60 backdrop-blur-md px-8 py-4 rounded-full border-4 border-blue-500"
            >
              <p className="text-blue-400 text-lg font-bold">
                ♠️ Spades - Make Your Bid!
              </p>
            </motion.div>
          </div>

          {/* Current Trick */}
          {currentTrick.length > 0 && (
            <div className="text-center">
              <p className="text-white text-lg mb-2">Current Trick:</p>
              <div className="flex justify-center gap-2">
                {currentTrick.map((t, i) => (
                  <div key={`trick-${t.card}-${i}`} className="text-2xl">{t.card}</div>
                ))}
              </div>
            </div>
          )}

          {/* Bidding Phase */}
          {game.game_state?.phase === 'bidding' && game.current_turn === 'player' && (
            <div className="text-center">
              <p className="text-cyan-400 text-lg mb-4">Place Your Bid (0-13):</p>
              <div className="flex justify-center gap-2 flex-wrap">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map(bid => (
                  <motion.button
                    key={bid}
                    onClick={() => handleBid(bid)}
                    disabled={makingMove || aiThinking}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-lg shadow-xl border-2 border-blue-400 min-w-[50px]"
                  >
                    {bid}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Turn Indicator */}
          {!gameOver && game.game_state?.phase === 'playing' && (
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-blue-400 font-bold text-center"
            >
              {game.current_turn === 'player' ? '🎯 Play a Card' : '⏳ AI Thinking...'}
            </motion.p>
          )}
        </div>
      )
    };

    switch(selectedTable) {
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
      {/* Victory Confetti */}
      {playerWon && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          colors={['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af']}
        />
      )}

      {/* Table Layout */}
      {renderTable()}

      {/* Settings Button */}
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
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-9xl mb-4"
              >
                {gameResult.type === 'win' ? '♠️' : '😔'}
              </motion.div>
              <h3 className={`text-5xl font-bold mb-4 ${
                gameResult.type === 'win' 
                  ? 'text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text' 
                  : 'text-transparent bg-gradient-to-r from-gray-400 to-gray-600 bg-clip-text'
              }`}>
                {gameResult.message}
              </h3>
              <p className="text-blue-400 text-2xl">Final Score: {playerScore} - {aiScore}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* AAA Card Juice - Particle Effects */}

      <ParticleEffectsOverlay />

    </>
  );
}
