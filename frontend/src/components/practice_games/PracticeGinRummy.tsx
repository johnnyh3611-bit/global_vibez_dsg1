
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { Settings, RotateCcw } from 'lucide-react';

// Import casino table layouts
import ClassicCasinoTable from '../casino/ClassicCasinoTable';
import CyberpunkNeonTable from '../casino/CyberpunkNeonTable';
import VIPLuxuryTable from '../casino/VIPLuxuryTable';
import MinimalistTable from '../casino/MinimalistTable';
import TableStyleSelector from '../casino/TableStyleSelector';

import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay from '@/components/ParticleEffectsOverlay';
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const createDeck = () => {
  const deck = [];
  SUITS.forEach(suit => {
    RANKS.forEach((rank, i) => {
      deck.push({ suit, rank, value: i + 1, color: suit === '♥' || suit === '♦' ? 'red' : 'black' });
    });
  });
  return deck.sort(() => Math.random() - 0.5);
};

export default function PracticeGinRummy({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const [playerHand, setPlayerHand] = useState([]);
  const [aiHand, setAiHand] = useState([]);
  const [deck, setDeck] = useState([]);
  const [discard, setDiscard] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [message, setMessage] = useState('Draw a card to start!');
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
  const [particleTrigger, setParticleTrigger] = useState(0);
  
  const { width, height } = useWindowSize();

  const startGame = () => {
    const shuffled = createDeck();
    cardSoundManager.playCardShuffle();
    setPlayerHand(shuffled.slice(0, 10));
    setAiHand(shuffled.slice(10, 20));
    setDeck(shuffled.slice(21));
    setDiscard([shuffled[20]]);
    setMessage('Draw from deck or discard pile');
    setSelectedCard(null);
    setGameOver(false);
    setDealerPhrase('shuffle');
    setDealerMood('professional');
  };

  useEffect(() => {
    startGame();
  }, []);

  const formatCard = (cardObj) => {
    if (!cardObj) return '';
    return `${cardObj.rank}${cardObj.suit}`;
  };

  const playerCards = playerHand.map(formatCard);
  const dealerCards = discard.length > 0 ? [formatCard(discard[discard.length - 1])] : [];

  const renderTable = () => {
    const tableProps = {
      balance: 1000,
      currentBet: 0,
      dealerCards,
      playerCards,
      dealerScore: aiHand.length,
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
      cardCount: deck.length,
      winStreak: 0,
      lossStreak: 0,
      gamePhase: gameOver ? 'finished' : 'playing',
      disabled: makingMove || aiThinking || gameOver,
      children: (
        <div className="space-y-6">
          {/* Game Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-green-400">
              <div className="text-green-200 text-sm">Deck</div>
              <div className="text-2xl font-bold text-white">{deck.length}</div>
            </div>
            <div className="bg-purple-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-purple-400">
              <div className="text-purple-200 text-sm">Discard</div>
              <div className="text-2xl font-bold text-white">{discard.length}</div>
            </div>
            <div className="bg-blue-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-blue-400">
              <div className="text-blue-200 text-sm">AI Cards</div>
              <div className="text-2xl font-bold text-white">{aiHand.length}</div>
            </div>
          </div>

          {/* Game Info */}
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block bg-black/60 backdrop-blur-md px-8 py-4 rounded-full border-4 border-cyan-500"
            >
              <p className="text-cyan-400 text-lg font-bold">
                🥃 Gin Rummy - Knock or Gin!
              </p>
            </motion.div>
          </div>

          {/* Message */}
          <div className="text-center">
            <motion.p
              key={message}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-2xl font-bold text-yellow-400"
            >
              {message}
            </motion.p>
          </div>

          {/* New Game Button */}
          <div className="text-center">
            <motion.button
              onClick={startGame}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold px-8 py-4 rounded-xl border-2 border-blue-400 hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="w-5 h-5" />
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
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
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
    </>
  );
}
