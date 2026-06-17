
import React, { useState, useEffect } from 'react';
import { Swords, Trophy, RotateCcw, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

// Import casino table layouts
import ClassicCasinoTable from '../casino/ClassicCasinoTable';
import CyberpunkNeonTable from '../casino/CyberpunkNeonTable';
import VIPLuxuryTable from '../casino/VIPLuxuryTable';
import MinimalistTable from '../casino/MinimalistTable';
import TableStyleSelector from '../casino/TableStyleSelector';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const createDeck = () => {
  const deck = [];
  SUITS.forEach(suit => {
    RANKS.forEach((rank, index) => {
      deck.push({ suit, rank, value: index + 2 });
    });
  });
  return deck.sort(() => Math.random() - 0.5);
};

export default function PracticeWar({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const [playerDeck, setPlayerDeck] = useState([]);
  const [aiDeck, setAiDeck] = useState([]);
  const [playerCard, setPlayerCard] = useState(null);
  const [aiCard, setAiCard] = useState(null);
  const [message, setMessage] = useState('');
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
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

  const startGame = () => {
    const deck = createDeck();
    const mid = Math.floor(deck.length / 2);
    setPlayerDeck(deck.slice(0, mid));
    setAiDeck(deck.slice(mid));
    setPlayerCard(null);
    setAiCard(null);
    setMessage('Click BATTLE to play!');
    setPlayerScore(0);
    setAiScore(0);
    setGameOver(false);
    setDealerPhrase('welcome');
    setDealerMood('professional');
  };

  useEffect(() => {
    startGame();
  }, []);

  const battle = () => {
    if (gameOver || playerDeck.length === 0 || aiDeck.length === 0) return;

    const pCard = playerDeck[0];
    const aCard = aiDeck[0];

    setPlayerCard(pCard);
    setAiCard(aCard);
    setIsDealing(true);
    setDealerPhrase('dealing');
    setDealerMood('neutral');

    setTimeout(() => {
      setIsDealing(false);
      
      if (pCard.value > aCard.value) {
        setMessage('You Win This Round!');
        setPlayerScore(prev => prev + 1);
        setPlayerDeck(prev => [...prev.slice(1), pCard, aCard]);
        setAiDeck(prev => prev.slice(1));
        setDealerPhrase('goodMove');
        setDealerMood('happy');
      } else if (aCard.value > pCard.value) {
        setMessage('AI Wins This Round!');
        setAiScore(prev => prev + 1);
        setAiDeck(prev => [...prev.slice(1), pCard, aCard]);
        setPlayerDeck(prev => prev.slice(1));
        setDealerPhrase('playerLoses');
        setDealerMood('professional');
      } else {
        setMessage('WAR! Tie!');
        setPlayerDeck(prev => prev.slice(1));
        setAiDeck(prev => prev.slice(1));
        setDealerPhrase('riskyMove');
        setDealerMood('excited');
      }

      // Check game over
      if (playerDeck.length <= 1) {
        setGameOver(true);
        setMessage('AI Wins the Game!');
        setDealerPhrase('playerLoses');
        setDealerMood('professional');
      } else if (aiDeck.length <= 1) {
        setGameOver(true);
        setMessage('You Win the Game! 🎉');
        setDealerPhrase('bigWin');
        setDealerMood('excited');
        setIsCelebrating(true);
        setTimeout(() => setIsCelebrating(false), 3000);
      }
    }, 500);
  };

  const formatCard = (card) => {
    if (!card) return null;
    return `${card.rank}${card.suit}`;
  };

  // Convert cards to format expected by casino table
  const playerCards = playerCard ? [formatCard(playerCard)] : [];
  const dealerCards = aiCard ? [formatCard(aiCard)] : [];

  // Render appropriate table layout
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
      cardCount: playerDeck.length,
      winStreak: 0,
      lossStreak: 0,
      gamePhase: gameOver ? 'finished' : 'playing',
      disabled: makingMove || aiThinking || gameOver,
      children: (
        <div className="space-y-6">
          {/* Game Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-blue-400">
              <div className="text-blue-200 text-sm">Your Deck</div>
              <div className="text-3xl font-bold text-white">{playerDeck.length}</div>
            </div>
            <div className="bg-purple-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-purple-400">
              <div className="text-purple-200 text-sm">Battle Score</div>
              <div className="text-xl font-bold text-white">{playerScore} - {aiScore}</div>
            </div>
            <div className="bg-red-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-red-400">
              <div className="text-red-200 text-sm">AI Deck</div>
              <div className="text-3xl font-bold text-white">{aiDeck.length}</div>
            </div>
          </div>

          {/* Battle Message */}
          <div className="text-center">
            <motion.p
              key={message}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-3xl font-bold text-yellow-400 drop-shadow-lg"
            >
              {message}
            </motion.p>
          </div>

          {/* Battle Controls */}
          <div className="flex gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={battle}
              disabled={gameOver}
              className="flex-1 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white font-bold text-xl rounded-xl border-2 border-red-400 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Swords className="w-6 h-6" />
              BATTLE!
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="flex-1 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-xl rounded-xl border-2 border-blue-400 hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-6 h-6" />
              New Game
            </motion.button>
          </div>
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
      {gameOver && playerScore > aiScore && (
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

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              className="bg-gradient-to-br from-yellow-900 to-orange-900 rounded-3xl p-8 border-4 border-yellow-400 text-center max-w-md"
            >
              <div className="text-6xl mb-4">{playerScore > aiScore ? '🏆' : '💔'}</div>
              <h2 className="text-4xl font-bold text-white mb-4">
                {playerScore > aiScore ? 'Victory!' : 'Defeat!'}
              </h2>
              <p className="text-2xl text-yellow-400 mb-6">Final Score: {playerScore} - {aiScore}</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startGame}
                className="px-8 py-4 bg-gradient-to-r from-green-600 to-cyan-600 text-white font-bold text-xl rounded-xl hover:shadow-2xl transition-all"
              >
                Play Again
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
