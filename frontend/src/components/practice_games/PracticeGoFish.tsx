
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
export function PracticeGoFish({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const playerHand = game.game_state?.player_hand || [];
  const playerBooks = game.game_state?.player_books || [];
  const aiBooks = game.game_state?.ai_books || [];
  const aiHandCount = game.game_state?.ai_hand_count || 7;
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

  // Update dealer based on game state
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
        setGameResult({ type: 'lose', message: 'AI Wins! 😔' });
        setDealerPhrase('playerLoses');
        setDealerMood('professional');
      }
    } else if (game.current_turn === 'player') {
      setDealerPhrase('playerTurn');
      setDealerMood('neutral');
    } else {
      setDealerPhrase('shuffle');
      setDealerMood('professional');
    }
  }, [gameOver, game.winner, game.current_turn]);

  const handleCardClick = (card) => {
    if (!gameOver && !makingMove && !aiThinking && game.current_turn === 'player') {
      const rank = card.replace(/[♠♥♦♣]/g, '');
      onMove({ rank });
      setIsDealing(true);
      setDealerPhrase('dealing');
      setTimeout(() => setIsDealing(false), 1000);
    }
  };

  const handleGoFish = () => {
    onMove({ action: 'go_fish' });
    setIsDealing(true);
    setDealerPhrase('shuffle');
    setTimeout(() => setIsDealing(false), 1000);
  };

  // Convert cards to casino table format
  const formatCard = (card) => card;
  const playerCards = playerHand.map(formatCard);

  // Render appropriate table layout
  const renderTable = () => {
    const tableProps = {
      balance: 1000,
      currentBet: 0,
      dealerCards: [],
      playerCards,
      dealerScore: aiBooks.length,
      playerScore: playerBooks.length,
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
      cardCount: aiHandCount,
      winStreak: 0,
      lossStreak: 0,
      gamePhase: gameOver ? 'finished' : 'playing',
      disabled: makingMove || aiThinking || gameOver || game.current_turn !== 'player',
      children: (
        <div className="space-y-6">
          {/* Books Display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-blue-400">
              <p className="text-blue-200 text-sm">Your Books</p>
              <p className="text-white text-3xl font-bold">{playerBooks.length} 📚</p>
            </div>
            <div className="bg-purple-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-purple-400">
              <p className="text-purple-200 text-sm">AI Books</p>
              <p className="text-white text-3xl font-bold">{aiBooks.length} 📚</p>
            </div>
          </div>

          {/* Game Info */}
          <div className="text-center space-y-4">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block bg-black/60 backdrop-blur-md px-8 py-4 rounded-full border-4 border-cyan-500"
            >
              <p className="text-cyan-400 text-lg font-bold">
                🐟 Collect 4 of a Kind
              </p>
            </motion.div>

            <div className="bg-purple-900/40 px-6 py-3 rounded-xl border-2 border-purple-500/50 inline-block">
              <p className="text-purple-300">AI has <span className="text-white font-bold text-xl">{aiHandCount}</span> cards</p>
            </div>
          </div>

          {/* Go Fish Button */}
          {game.current_turn === 'player' && !gameOver && (
            <div className="text-center">
              <motion.button
                onClick={handleGoFish}
                disabled={makingMove || aiThinking}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 disabled:opacity-50 text-white font-bold px-8 py-4 rounded-xl shadow-2xl border-2 border-cyan-400"
              >
                🐟 GO FISH!
              </motion.button>
            </div>
          )}

          {/* Turn Indicator */}
          {!gameOver && (
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-cyan-400 font-bold text-center"
            >
              {game.current_turn === 'player' ? '🎯 Click a Card to Ask' : '⏳ AI Thinking...'}
            </motion.p>
          )}

          {/* Click Instructions */}
          {game.current_turn === 'player' && !gameOver && (
            <p className="text-white/60 text-sm text-center">
              Click any card in your hand to ask the AI for that rank
            </p>
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
          colors={['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']}
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
                {gameResult.type === 'win' ? '🐟' : '😔'}
              </motion.div>
              <h3 className={`text-5xl font-bold mb-4 ${
                gameResult.type === 'win' 
                  ? 'text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text' 
                  : 'text-transparent bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text'
              }`}>
                {gameResult.message}
              </h3>
              <p className="text-cyan-400 text-3xl font-bold">{playerBooks.length} vs {aiBooks.length} Books</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* AAA Card Juice - Particle Effects */}

      <ParticleEffectsOverlay />

    </>
  );
}
