
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
export function PracticeRummy({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const playerHand = game.game_state?.player_hand || [];
  const aiHandCount = game.game_state?.ai_hand_count || 10;
  const discardPile = game.game_state?.discard_pile || [];
  const [selectedCards, setSelectedCards] = useState([]);
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
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter(c => c !== card));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleMeld = () => {
    if (selectedCards.length >= 3) {
      onMove({ action: 'meld', cards: selectedCards });
      setSelectedCards([]);
      setIsDealing(true);
      setDealerPhrase('goodMove');
      setTimeout(() => setIsDealing(false), 1000);
    }
  };

  const handleDrawFromDeck = () => {
    onMove({ action: 'draw_deck' });
    setIsDealing(true);
    setDealerPhrase('shuffle');
    setTimeout(() => setIsDealing(false), 1000);
  };

  const handleDrawFromDiscard = () => {
    onMove({ action: 'draw_discard' });
    setIsDealing(true);
    setDealerPhrase('dealing');
    setTimeout(() => setIsDealing(false), 1000);
  };

  const handleDiscard = (card) => {
    onMove({ action: 'discard', card });
    setIsDealing(true);
    setDealerPhrase('dealing');
    setTimeout(() => setIsDealing(false), 1000);
  };

  // Convert cards to casino table format
  const playerCards = playerHand.map(card => card);
  const dealerCards = discardPile.length > 0 ? [discardPile[discardPile.length - 1]] : [];

  // Render appropriate table layout
  const renderTable = () => {
    const tableProps = {
      balance: 1000,
      currentBet: 0,
      dealerCards,
      playerCards,
      dealerScore: aiHandCount,
      playerScore: playerHand.length,
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
      disabled: makingMove || aiThinking || gameOver,
      children: (
        <div className="space-y-6">
          {/* Top Card & Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-purple-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-purple-400">
              <p className="text-purple-200 text-sm">Discard Pile</p>
              <p className="text-white text-2xl font-bold">
                {discardPile.length > 0 ? discardPile[discardPile.length - 1] : 'Empty'}
              </p>
            </div>
            <div className="bg-blue-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-blue-400">
              <p className="text-blue-200 text-sm">AI Cards</p>
              <p className="text-white text-3xl font-bold">{aiHandCount}</p>
            </div>
          </div>

          {/* Game Info */}
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block bg-black/60 backdrop-blur-md px-8 py-4 rounded-full border-4 border-purple-500"
            >
              <p className="text-purple-400 text-lg font-bold">
                🎴 Meld Sets & Runs
              </p>
            </motion.div>
            {selectedCards.length > 0 && (
              <p className="text-cyan-400 mt-2">Selected: {selectedCards.length} cards</p>
            )}
          </div>

          {/* Action Buttons */}
          {!gameOver && game.current_turn === 'player' && (
            <div className="flex flex-wrap gap-4 justify-center">
              <motion.button
                onClick={handleDrawFromDeck}
                disabled={makingMove || aiThinking}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl shadow-2xl border-2 border-green-400"
              >
                🎴 Draw from Deck
              </motion.button>
              {discardPile.length > 0 && (
                <motion.button
                  onClick={handleDrawFromDiscard}
                  disabled={makingMove || aiThinking}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-purple-600 to-pink-700 hover:from-purple-700 hover:to-pink-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl shadow-2xl border-2 border-purple-400"
                >
                  📥 Draw from Discard
                </motion.button>
              )}
              {selectedCards.length >= 3 && (
                <motion.button
                  onClick={handleMeld}
                  disabled={makingMove || aiThinking}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-yellow-600 to-amber-700 hover:from-yellow-700 hover:to-amber-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl shadow-2xl border-2 border-yellow-400"
                >
                  ✨ Meld ({selectedCards.length})
                </motion.button>
              )}
            </div>
          )}

          {/* Turn Indicator */}
          {!gameOver && (
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-purple-400 font-bold text-center"
            >
              {game.current_turn === 'player' ? '🎯 Your Turn' : '⏳ AI Thinking...'}
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
          colors={['#a855f7', '#ec4899', '#f43f5e', '#fb923c']}
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
                {gameResult.type === 'win' ? '🎴' : '😔'}
              </motion.div>
              <h3 className={`text-5xl font-bold mb-4 ${
                gameResult.type === 'win' 
                  ? 'text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text' 
                  : 'text-transparent bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text'
              }`}>
                {gameResult.message}
              </h3>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
