
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import CasinoTable3D from '../casino/CasinoTable3D';
import BackButton from '../BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Premium 3D Card Component
const PokerCard3D = ({ card, size = 'md', delay = 0, faceDown = false }: { card?: any; size?: string; delay?: number; faceDown?: boolean }) => {
  if (!card && !faceDown) return null;
  
  const sizeClasses = {
    sm: 'w-14 h-20',
    md: 'w-20 h-28',
    lg: 'w-24 h-36'
  };
  
  const suits = { H: '♥', D: '♦', C: '♣', S: '♠' };
  const suitColors = { H: '#DC2626', D: '#DC2626', C: '#1F2937', S: '#1F2937' };
  
  const rank = card ? card.slice(0, -1) : '?';
  const suit = card ? card.slice(-1) : '';
  
  return (
    <motion.div
      initial={{ y: -100, opacity: 0, rotateY: 180 }}
      animate={{ y: 0, opacity: 1, rotateY: faceDown ? 180 : 0 }}
      transition={{ delay, type: 'spring', stiffness: 100, damping: 15 }}
      whileHover={!faceDown ? { y: -8, scale: 1.05 } : {}}
      className={`${sizeClasses[size]} relative cursor-pointer`}
      style={{ 
        transformStyle: 'preserve-3d',
        perspective: '1000px'
      }}
    >
      {/* Front of Card */}
      <div 
        className="absolute inset-0 bg-white rounded-lg shadow-2xl flex flex-col justify-between p-2 border border-gray-200"
        style={{ 
          backfaceVisibility: 'hidden',
          transform: 'rotateY(0deg)'
        }}
      >
        <div className="flex flex-col items-start" style={{ color: suitColors[suit] }}>
          <span className="text-lg font-black leading-none">{rank}</span>
          <span className="text-sm leading-none">{suits[suit]}</span>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <span className="text-5xl" style={{ color: suitColors[suit] }}>
            {suits[suit]}
          </span>
        </div>
        
        <div className="flex flex-col items-end rotate-180" style={{ color: suitColors[suit] }}>
          <span className="text-lg font-black leading-none">{rank}</span>
          <span className="text-sm leading-none">{suits[suit]}</span>
        </div>
      </div>
      
      {/* Back of Card */}
      <div 
        className="absolute inset-0 rounded-lg shadow-2xl"
        style={{ 
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: 'linear-gradient(135deg, #7C2D12 0%, #DC2626 50%, #7C2D12 100%)'
        }}
      >
        <div className="w-full h-full flex items-center justify-center p-2">
          <div className="border-2 border-amber-400/40 w-full h-full rounded flex items-center justify-center">
            <div className="text-amber-400/30 text-xs font-bold">VIBES</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Premium Poker Chip
const PokerChip = ({ value, color = 'from-amber-600 to-yellow-500' }) => (
  <motion.div
    whileHover={{ scale: 1.1, rotate: 5 }}
    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-br ${color} text-white text-sm font-black shadow-lg border-2 border-white/30`}
  >
    <span className="text-xs">$</span>
    <span>{value}</span>
  </motion.div>
);

export default function PokerAAA() {
  const [gameState, setGameState] = useState('betting'); // betting, playing, showdown, finished
  const [playerHand, setPlayerHand] = useState([]);
  const [aiHand, setAiHand] = useState([]);
  const [communityCards, setCommunityCards] = useState([]);
  const [pot, setPot] = useState(0);
  const [playerChips, setPlayerChips] = useState(1000);
  const [aiChips, setAiChips] = useState(1000);
  const [currentBet, setCurrentBet] = useState(0);
  const [playerBet, setPlayerBet] = useState(0);
  const [aiBet, setAiBet] = useState(0);
  const [raiseAmount, setRaiseAmount] = useState(50);
  const [gameResult, setGameResult] = useState(null);
  const [handStrength, setHandStrength] = useState('');
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  
  const { width, height } = useWindowSize();

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dealNewHand = () => {
    // Reset for new hand
    setGameState('playing');
    setPlayerHand(['AS', 'KH']); // Demo cards
    setAiHand(['?', '?']); // Hidden AI cards
    setCommunityCards([]);
    setPot(0);
    setPlayerBet(0);
    setAiBet(0);
    setCurrentBet(0);
    setGameResult(null);
    setHandStrength('High Card');
  };

  const handleAction = (action) => {
    if (action === 'fold') {
      setGameResult({ type: 'lose', message: 'You Folded', winner: 'ai' });
      setGameState('finished');
      setAiChips(prev => prev + pot);
    } else if (action === 'call') {
      const callAmount = currentBet - playerBet;
      setPlayerChips(prev => prev - callAmount);
      setPlayerBet(currentBet);
      setPot(prev => prev + callAmount);
      // Progress to next phase
      progressGame();
    } else if (action === 'raise') {
      const totalRaise = currentBet - playerBet + raiseAmount;
      setPlayerChips(prev => prev - totalRaise);
      setPlayerBet(prev => prev + totalRaise);
      setCurrentBet(prev => prev + raiseAmount);
      setPot(prev => prev + totalRaise);
      // AI responds
      aiRespond();
    }
  };

  const progressGame = () => {
    if (communityCards.length === 0) {
      // Flop
      setCommunityCards(['QH', 'JD', '10S']);
    } else if (communityCards.length === 3) {
      // Turn
      setCommunityCards(prev => [...prev, '9C']);
    } else if (communityCards.length === 4) {
      // River
      setCommunityCards(prev => [...prev, '8H']);
      // Then showdown
      setTimeout(() => showdown(), 1000);
    }
  };

  const aiRespond = () => {
    // Simple AI logic
    const action = Math.random() > 0.5 ? 'call' : 'fold';
    if (action === 'call') {
      const callAmount = currentBet - aiBet;
      setAiChips(prev => prev - callAmount);
      setAiBet(currentBet);
      setPot(prev => prev + callAmount);
      progressGame();
    } else {
      setGameResult({ type: 'win', message: 'AI Folded!', winner: 'player' });
      setGameState('finished');
      setPlayerChips(prev => prev + pot);
    }
  };

  const showdown = () => {
    setAiHand(['KC', 'QD']); // Reveal AI cards
    setGameState('showdown');
    
    // Determine winner (simplified)
    const winner = Math.random() > 0.5 ? 'player' : 'ai';
    setGameResult({
      type: winner === 'player' ? 'win' : 'lose',
      message: winner === 'player' ? 'You Win!' : 'AI Wins',
      winner
    });
    
    setTimeout(() => {
      setGameState('finished');
      if (winner === 'player') {
        setPlayerChips(prev => prev + pot);
      } else {
        setAiChips(prev => prev + pot);
      }
    }, 2000);
  };

  return (
    <CasinoTable3D gameType="poker">
      <BackButton to="/games" label="Back" variant="casino" />

      {gameResult?.type === 'win' && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.15}
        />
      )}

      {/* Premium Poker Table Layout */}
      <div className={`fixed inset-0 flex items-center justify-center p-4 ${isLandscape ? 'landscape' : 'portrait'}`}>
        <div className="relative w-full max-w-6xl">
          
          {/* VIP Table - Authentic Green Felt */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-gradient-to-br from-green-900 via-green-800 to-green-900 rounded-[3rem] p-8 shadow-2xl border-8 border-amber-900"
            style={{
              backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(34, 197, 94, 0.1) 0%, transparent 50%), url("data:image/svg+xml,%3Csvg width="60" height="60" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M0 0h60v60H0z" fill="none"/%3E%3Cpath d="M30 30m-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0" fill="rgba(0,0,0,0.05)"/%3E%3C/svg%3E")',
              boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.5), 0 20px 60px rgba(0,0,0,0.6)'
            }}
          >
            
            {/* Leather Table Edge Highlight */}
            <div className="absolute inset-0 rounded-[3rem] pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 0 12px rgba(120, 53, 15, 0.6), inset 0 0 0 16px rgba(217, 119, 6, 0.3)'
              }}
            />

            {/* AI Section */}
            <div className="flex flex-col items-center mb-8">
              <div className="flex items-center gap-3 mb-4 bg-black/30 px-6 py-3 rounded-full backdrop-blur-sm border border-amber-900/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-rose-800 flex items-center justify-center text-white font-black shadow-lg">
                  AI
                </div>
                <div>
                  <p className="text-amber-200 text-xs font-semibold">Opponent</p>
                  <PokerChip value={aiChips} color="from-red-600 to-rose-700" />
                </div>
              </div>
              
              {/* AI Cards */}
              <div className="flex gap-2">
                {(gameState === 'showdown' || gameState === 'finished') ? (
                  aiHand.map((card, i) => (
                    <PokerCard3D key={`aiHand-${i}`} card={card} size="md" delay={i * 0.1} />
                  ))
                ) : (
                  [1, 2].map((_, i) => (
                    <PokerCard3D key={`aiHand-${i}`} faceDown delay={i * 0.1} size="md" />
                  ))
                )}
              </div>
            </div>

            {/* Community Cards */}
            <div className="mb-8">
              <div className="flex justify-center gap-3 mb-6 min-h-[7rem]">
                {communityCards.map((card, i) => (
                  <PokerCard3D key={card.id || `communityCards-${i}`} card={card} size="lg" delay={i * 0.15} />
                ))}
                {[...Array(5 - communityCards.length)].map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-24 h-36 rounded-lg border-2 border-dashed border-amber-900/30 flex items-center justify-center bg-black/10"
                  >
                    <span className="text-amber-900/30 text-3xl font-bold">?</span>
                  </div>
                ))}
              </div>

              {/* Pot Display */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex justify-center"
              >
                <div className="bg-black/50 backdrop-blur-md px-8 py-4 rounded-2xl border-2 border-amber-500/70 shadow-2xl">
                  <p className="text-amber-300 text-xs font-bold mb-1 text-center">💰 POT</p>
                  <p className="text-4xl font-black text-amber-400 text-center">${pot}</p>
                </div>
              </motion.div>
            </div>

            {/* Player Section */}
            <div className="flex flex-col items-center">
              {/* Player Cards */}
              <div className="flex gap-3 mb-4">
                {playerHand.map((card, i) => (
                  <PokerCard3D key={`item-${i}`} card={card} size="lg" delay={0.3 + i * 0.1} />
                ))}
              </div>

              <div className="flex items-center gap-3 mb-4 bg-black/30 px-6 py-3 rounded-full backdrop-blur-sm border border-amber-900/50">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center text-white font-black shadow-lg">
                  YOU
                </div>
                <div>
                  <p className="text-cyan-200 text-xs font-semibold">Your Chips</p>
                  <PokerChip value={playerChips} color="from-blue-600 to-cyan-600" />
                </div>
              </div>

              {/* Hand Strength */}
              {gameState === 'playing' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 px-4 py-2 bg-amber-500/20 border border-amber-500/50 rounded-lg"
                >
                  <p className="text-amber-200 text-sm font-bold">✨ {handStrength}</p>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Action Controls */}
          <div className="mt-6 max-w-2xl mx-auto">
            {gameState === 'betting' && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={dealNewHand}
                className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black py-6 rounded-2xl shadow-2xl text-xl"
              >
                🃏 DEAL CARDS
              </motion.button>
            )}

            {gameState === 'playing' && (
              <div className="space-y-3">
                {/* Raise Slider */}
                <div className="bg-black/30 backdrop-blur-md p-4 rounded-xl border border-amber-900/50">
                  <label className="text-amber-200 text-sm font-bold mb-2 block">Raise Amount: ${raiseAmount}</label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={raiseAmount}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    className="w-full h-2 bg-amber-900/50 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAction('fold')}
                    className="bg-gradient-to-br from-red-700 to-red-900 hover:from-red-800 hover:to-red-950 text-white font-bold py-4 rounded-xl shadow-lg"
                  >
                    🚫 FOLD
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAction('call')}
                    className="bg-gradient-to-br from-blue-700 to-blue-900 hover:from-blue-800 hover:to-blue-950 text-white font-bold py-4 rounded-xl shadow-lg"
                  >
                    🤝 CALL
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAction('raise')}
                    className="bg-gradient-to-br from-green-700 to-emerald-900 hover:from-green-800 hover:to-emerald-950 text-white font-bold py-4 rounded-xl shadow-lg"
                  >
                    📈 RAISE
                  </motion.button>
                </div>
              </div>
            )}

            {gameState === 'finished' && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={dealNewHand}
                className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black py-6 rounded-2xl shadow-2xl text-xl"
              >
                🔄 NEW HAND
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Game Result Overlay */}
      <AnimatePresence>
        {gameResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-gradient-to-br from-amber-900 to-amber-950 rounded-3xl p-12 text-center border-4 border-amber-600 shadow-2xl max-w-md"
            >
              <div className="text-8xl mb-6">
                {gameResult.type === 'win' ? '🏆' : gameResult.type === 'lose' ? '😔' : '🤝'}
              </div>
              <h3 className={`text-5xl font-black mb-6 ${
                gameResult.type === 'win' ? 'text-green-400' : 
                gameResult.type === 'lose' ? 'text-red-400' : 'text-blue-400'
              }`}>
                {gameResult.message}
              </h3>
              {pot > 0 && (
                <PokerChip value={pot} color="from-amber-500 to-yellow-500" />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Landscape Helper */}
      {!isLandscape && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-amber-600/90 backdrop-blur-sm px-4 py-2 rounded-full text-white text-xs font-bold z-40">
          💡 Rotate device for best experience
        </div>
      )}
    </CasinoTable3D>
  );
}
