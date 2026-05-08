
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
    RANKS.forEach(rank => {
      deck.push(`${rank}${suit}`);
    });
  });
  return deck.sort(() => Math.random() - 0.5);
};

export default function PracticeSolitaire({ game, onMove, makingMove, aiThinking }: { game?: any, onMove?: any, makingMove?: any, aiThinking?: any }) {
  const [deck, setDeck] = useState([]);
  const [tableau, setTableau] = useState([[], [], [], [], [], [], []]);
  const [foundation, setFoundation] = useState([[], [], [], []]);
  const [waste, setWaste] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  
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
    const newTableau = [[], [], [], [], [], [], []];
    let deckIndex = 0;
    
    // Play shuffle sound
    cardSoundManager.playCardShuffle();
    
    for (let i = 0; i < 7; i++) {
      for (let j = i; j < 7; j++) {
        newTableau[j].push(shuffled[deckIndex++]);
      }
    }
    
    setTableau(newTableau);
    setDeck(shuffled.slice(deckIndex));
    setFoundation([[], [], [], []]);
    setWaste([]);
    setMoves(0);
    setGameWon(false);
    setSelectedCard(null);
    setDealerPhrase('shuffle');
    setDealerMood('professional');
    setIsDealing(true);
    setTimeout(() => setIsDealing(false), 1000);
  };

  useEffect(() => {
    startGame();
  }, []);

  useEffect(() => {
    // Check win condition
    if (foundation.every(pile => pile.length === 13)) {
      setGameWon(true);
      setDealerPhrase('bigWin');
      setDealerMood('excited');
      setIsCelebrating(true);
      cardSoundManager.playWinSound();
      setParticleTrigger(prev => prev + 1);
      setTimeout(() => setIsCelebrating(false), 3000);
    }
  }, [foundation]);

  const drawCard = () => {
    if (deck.length > 0) {
      cardSoundManager.playCardFlip();
      setWaste([...waste, deck[deck.length - 1]]);
      setDeck(deck.slice(0, -1));
      setMoves(moves + 1);
    }
  };

  // Get visible cards for display
  const getVisibleCards = () => {
    const visible = [];
    tableau.forEach(pile => {
      if (pile.length > 0) {
        visible.push(pile[pile.length - 1]);
      }
    });
    if (waste.length > 0) {
      visible.push(waste[waste.length - 1]);
    }
    return visible;
  };

  const playerCards = getVisibleCards();
  const dealerCards = foundation.flat().slice(-4); // Show foundation top cards

  const renderTable = () => {
    const tableProps = {
      balance: 1000,
      currentBet: 0,
      dealerCards,
      playerCards,
      dealerScore: foundation.flat().length,
      playerScore: tableau.flat().length,
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
      gamePhase: gameWon ? 'finished' : 'playing',
      disabled: makingMove || aiThinking || gameWon,
      children: (
        <div className="space-y-6">
          {/* Game Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-green-400">
              <div className="text-green-200 text-sm">Deck</div>
              <div className="text-2xl font-bold text-white">{deck.length}</div>
            </div>
            <div className="bg-purple-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-purple-400">
              <div className="text-purple-200 text-sm">Moves</div>
              <div className="text-2xl font-bold text-white">{moves}</div>
            </div>
            <div className="bg-blue-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-blue-400">
              <div className="text-blue-200 text-sm">Tableau</div>
              <div className="text-2xl font-bold text-white">{tableau.flat().length}</div>
            </div>
            <div className="bg-yellow-900/40 backdrop-blur-sm rounded-xl p-4 border-2 border-yellow-400">
              <div className="text-yellow-200 text-sm">Foundation</div>
              <div className="text-2xl font-bold text-white">{foundation.flat().length}/52</div>
            </div>
          </div>

          {/* Game Info */}
          <div className="text-center">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block bg-black/60 backdrop-blur-md px-8 py-4 rounded-full border-4 border-green-500"
            >
              <p className="text-green-400 text-lg font-bold">
                🂡 Klondike Solitaire
              </p>
            </motion.div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <motion.button
              onClick={drawCard}
              disabled={deck.length === 0}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl shadow-2xl border-2 border-green-400"
            >
              🎴 Draw Card ({deck.length})
            </motion.button>
            <motion.button
              onClick={startGame}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold px-6 py-3 rounded-xl border-2 border-blue-400 hover:shadow-xl transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              New Game
            </motion.button>
          </div>

          {gameWon && (
            <div className="text-center">
              <motion.p
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-4xl font-bold text-yellow-400"
              >
                🎉 You Won in {moves} moves! 🎉
              </motion.p>
            </div>
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
      {/* Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger > 0 ? { x: 0, y: 0 } : null} />
      
      {/* Victory Confetti */}
      {gameWon && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
          colors={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b']}
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
    </>
  );
}
