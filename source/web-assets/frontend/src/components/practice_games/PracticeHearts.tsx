
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
export function PracticeHearts({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const playerHand = game.game_state?.player_hand || [];
  const currentTrick = game.game_state?.current_trick || [];
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
        setGameResult({ type: 'win', message: 'You Win! 🎉' });
        setDealerPhrase('bigWin');
        setDealerMood('excited');
        setIsCelebrating(true);
        setTimeout(() => setIsCelebrating(false), 3000);
      } else {
        cardSoundManager.playLoseSound(); // AAA Card Juice
        setGameResult({ type: 'lose', message: 'AI Wins! 😔' });
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
      disabled: makingMove || aiThinking || gameOver || game.current_turn !== 'player',
      children: (
        <div className="space-y-6">
          {/* Score Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-red-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-red-400">
              <p className="text-red-200 text-sm">Your Score (Lower is Better)</p>
              <p className="text-white text-3xl font-bold">{playerScore} ♥️</p>
            </div>
            <div className="bg-purple-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-purple-400">
              <p className="text-purple-200 text-sm">AI Score</p>
              <p className="text-white text-3xl font-bold">{aiScore} ♥️</p>
            </div>
          </div>

          {/* Game Info */}
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block bg-black/60 backdrop-blur-md px-8 py-4 rounded-full border-4 border-red-500"
            >
              <p className="text-red-400 text-lg font-bold">
                ♥️ Hearts - Avoid Hearts!
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

          {/* Turn Indicator */}
          {!gameOver && (
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-red-400 font-bold text-center"
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
          colors={['#ef4444', '#dc2626', '#991b1b', '#7f1d1d']}
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
                {gameResult.type === 'win' ? '♥️' : '😔'}
              </motion.div>
              <h3 className={`text-5xl font-bold mb-4 ${
                gameResult.type === 'win' 
                  ? 'text-transparent bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text' 
                  : 'text-transparent bg-gradient-to-r from-gray-400 to-gray-600 bg-clip-text'
              }`}>
                {gameResult.message}
              </h3>
              <p className="text-red-400 text-2xl">Final Score: {playerScore} - {aiScore}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* AAA Card Juice - Particle Effects */}

      <ParticleEffectsOverlay />

    </>
  );
}
