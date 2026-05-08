
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import CasinoTable3D from '../casino/CasinoTable3D';
import BackButton from '../BackButton';
import PokerTableWrapper from '../poker/PokerTableWrapper';
import { ActionBar } from '../poker/ActionBar';
import { useOrientation } from '../../hooks/useOrientation';
import { formatCard } from '../../utils/pokerHelpers';
import SocialOverlay from '../social/SocialOverlay';
import SocialGameButton from './SocialGameButton';
import { useSocialSocket } from '../../hooks/useSocialSocket';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Premium 3D Playing Card Component with Framer Motion
const PlayingCard3D = ({ card, size = 'md', index = 0, faceDown = false }: { card?: any; size?: string; index?: number; faceDown?: boolean }) => {
  if (!card && !faceDown) return null;
  
  const sizeClasses = {
    sm: 'w-12 h-18 text-xs',
    md: 'w-16 sm:w-20 h-24 sm:h-28 text-sm',
    lg: 'w-20 sm:w-24 h-30 sm:h-36 text-base'
  };
  
  const formattedCard = card && card !== 'BACK' ? formatCard(card) : null;
  
  return (
    <motion.div
      initial={{ y: -200, opacity: 0, rotateY: 180 }}
      animate={{ y: 0, opacity: 1, rotateY: faceDown ? 180 : 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 100, damping: 15 }}
      whileHover={!faceDown ? { y: -8, scale: 1.05 } : {}}
      className={`${sizeClasses[size]} relative cursor-pointer`}
      style={{ 
        transformStyle: 'preserve-3d',
        perspective: '1000px'
      }}
    >
      {/* Front of Card */}
      <div 
        className="absolute inset-0 bg-white rounded-lg shadow-2xl flex flex-col justify-between p-1 sm:p-2 border border-gray-200"
        style={{ 
          backfaceVisibility: 'hidden',
          transform: 'rotateY(0deg)'
        }}
      >
        {formattedCard && (
          <>
            <div className="flex flex-col items-start" style={{ color: formattedCard.color === 'red' ? '#DC2626' : '#1F2937' }}>
              <span className="font-black leading-none">{formattedCard.rank}</span>
              <span className="text-xs sm:text-sm leading-none">{formattedCard.suitSymbol}</span>
            </div>
            
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <span className="text-2xl sm:text-4xl" style={{ color: formattedCard.color === 'red' ? '#DC2626' : '#1F2937' }}>
                {formattedCard.suitSymbol}
              </span>
            </div>
            
            <div className="flex flex-col items-end rotate-180" style={{ color: formattedCard.color === 'red' ? '#DC2626' : '#1F2937' }}>
              <span className="font-black leading-none">{formattedCard.rank}</span>
              <span className="text-xs sm:text-sm leading-none">{formattedCard.suitSymbol}</span>
            </div>
          </>
        )}
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
            <div className="text-amber-400/30 text-xs font-bold">DSG</div>
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
    className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full bg-gradient-to-br ${color} text-white text-xs sm:text-sm font-black shadow-lg border-2 border-white/30`}
  >
    <span className="text-xs">$</span>
    <span>{value}</span>
  </motion.div>
);

export default function PokerAAAResponsive() {
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
  
  // Social overlay state
  const [showSocialOverlay, setShowSocialOverlay] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState([]);
  
  const isLandscape = useOrientation();
  const { width, height } = useWindowSize();

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Social WebSocket
  const { isConnected, joinGameRoom, leaveGameRoom } = useSocialSocket('current_user', 'Poker Player');

  // Join social game room
  useEffect(() => {
    // Only join room if socket is connected
    if (!isConnected) return;
    
    joinGameRoom('poker', 'table_main_1')
      .catch(err => console.error('Failed to join poker room:', err));
    
    return () => {
      if (isConnected) {
        leaveGameRoom('poker', 'table_main_1');
      }
    };
  }, [joinGameRoom, leaveGameRoom, isConnected]);

  const fetchNearbyPlayers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/social/nearby-players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'current_user', game_id: 'poker', table_id: 'table_main_1' })
      });
      const data = await response.json();
      setNearbyPlayers(data.players || []);
    } catch (error) {
      // console.error('Failed to fetch nearby players:', error);
    }
  };

  const handleSendVibe = async (player) => {
    try {
      await fetch(`${API_URL}/api/social/send-vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_user_id: 'current_user', to_user_id: player.id, vibe_type: 'drink', message: 'Great hand! 🃏' })
      });
    } catch (error) {
      // console.error('Failed to send vibe:', error);
    }
  };

  const dealNewHand = () => {
    setGameState('playing');
    setPlayerHand(['AS', 'KH']);
    setAiHand(['?', '?']);
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
      progressGame();
    } else if (action === 'raise') {
      const totalRaise = currentBet - playerBet + raiseAmount;
      setPlayerChips(prev => prev - totalRaise);
      setPlayerBet(prev => prev + totalRaise);
      setCurrentBet(prev => prev + raiseAmount);
      setPot(prev => prev + totalRaise);
      aiRespond();
    }
  };

  const progressGame = () => {
    if (communityCards.length === 0) {
      setCommunityCards(['QH', 'JD', '10S']);
    } else if (communityCards.length === 3) {
      setCommunityCards(prev => [...prev, '9C']);
    } else if (communityCards.length === 4) {
      setCommunityCards(prev => [...prev, '8H']);
      setTimeout(() => showdown(), 1000);
    }
  };

  const aiRespond = () => {
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
    setAiHand(['KC', 'QD']);
    setGameState('showdown');
    
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

      {/* Social Players Button */}
      <SocialGameButton
        onClick={() => {
          setShowSocialOverlay(true);
          fetchNearbyPlayers();
        }}
        nearbyCount={nearbyPlayers.length}
        position="top-20"
      />

      {/* Social Overlay */}
      <SocialOverlay
        visible={showSocialOverlay}
        onClose={() => setShowSocialOverlay(false)}
        nearbyPlayers={nearbyPlayers}
        onSendVibe={handleSendVibe}
      />

      {gameResult?.type === 'win' && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.15}
        />
      )}

      {/* Responsive Container */}
      <div className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <div className="relative w-full max-w-7xl">
          
          {/* Premium Poker Table - Fully Responsive */}
          <PokerTableWrapper>
            
            {/* AI Section - Top */}
            <div className="absolute top-[5%] left-1/2 transform -translate-x-1/2 flex flex-col items-center z-10">
              <div className="flex items-center gap-2 mb-2 sm:mb-3 bg-black/40 px-3 sm:px-6 py-2 sm:py-3 rounded-full backdrop-blur-sm border border-red-900/50">
                <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-red-600 to-rose-800 flex items-center justify-center text-white text-xs sm:text-sm font-black shadow-lg">
                  AI
                </div>
                <div>
                  <p className="text-amber-200 text-xs font-semibold">Opponent</p>
                  <PokerChip value={aiChips} color="from-red-600 to-rose-700" />
                </div>
              </div>
              
              {/* AI Cards */}
              <div className="flex gap-1 sm:gap-2">
                {(gameState === 'showdown' || gameState === 'finished') ? (
                  aiHand.map((card, i) => (
                    <PlayingCard3D key={`item-${i}-${Date.now()}`} card={card} size="sm" index={i} />
                  ))
                ) : (
                  [1, 2].map((_, i) => (
                    <PlayingCard3D key={`item-${i}-${Date.now()}`} faceDown index={i} size="sm" />
                  ))
                )}
              </div>
            </div>

            {/* Community Cards - Center */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
              <div className="flex justify-center gap-1 sm:gap-2 mb-3 sm:mb-4">
                {communityCards.map((card, i) => (
                  <PlayingCard3D key={`item-${i}-${Date.now()}`} card={card} size="md" index={i} />
                ))}
                {[...Array(5 - communityCards.length)].map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="w-16 sm:w-20 h-24 sm:h-28 rounded-lg border-2 border-dashed border-amber-900/30 flex items-center justify-center bg-black/10"
                  >
                    <span className="text-amber-900/30 text-xl sm:text-2xl font-bold">?</span>
                  </div>
                ))}
              </div>

              {/* Pot Display */}
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex justify-center"
              >
                <div className="bg-black/60 backdrop-blur-md px-4 sm:px-8 py-2 sm:py-4 rounded-2xl border-2 border-amber-500/70 shadow-2xl">
                  <p className="text-amber-300 text-xs font-bold mb-1 text-center">💰 POT</p>
                  <p className="text-2xl sm:text-4xl font-black text-amber-400 text-center">${pot}</p>
                </div>
              </motion.div>
            </div>

            {/* Player Section - Bottom */}
            <div className="absolute bottom-[5%] left-1/2 transform -translate-x-1/2 flex flex-col items-center z-10">
              {/* Player Cards */}
              <div className="flex gap-1 sm:gap-3 mb-2 sm:mb-4">
                {playerHand.map((card, i) => (
                  <PlayingCard3D key={`item-${i}-${Date.now()}`} card={card} size="md" index={0.3 + i * 0.1} />
                ))}
              </div>

              <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4 bg-black/40 px-3 sm:px-6 py-2 sm:py-3 rounded-full backdrop-blur-sm border border-cyan-900/50">
                <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-700 flex items-center justify-center text-white text-xs sm:text-sm font-black shadow-lg">
                  YOU
                </div>
                <div>
                  <p className="text-cyan-200 text-xs font-semibold">Your Chips</p>
                  <PokerChip value={playerChips} color="from-blue-600 to-cyan-600" />
                </div>
              </div>

              {/* Hand Strength */}
              {gameState === 'playing' && handStrength && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-3 sm:px-4 py-1 sm:py-2 bg-amber-500/20 border border-amber-500/50 rounded-lg"
                >
                  <p className="text-amber-200 text-xs sm:text-sm font-bold">✨ {handStrength}</p>
                </motion.div>
              )}
            </div>
          </PokerTableWrapper>

          {/* Action Controls - Fixed at Bottom */}
          {gameState === 'betting' && (
            <div className="mt-4 sm:mt-6">
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={dealNewHand}
                className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black py-4 sm:py-6 rounded-2xl shadow-2xl text-lg sm:text-xl"
              >
                🃏 DEAL CARDS
              </motion.button>
            </div>
          )}

          {gameState === 'playing' && (
            <ActionBar
              onFold={() => handleAction('fold')}
              onCall={() => handleAction('call')}
              onRaise={() => handleAction('raise')}
              raiseAmount={raiseAmount}
              onRaiseChange={setRaiseAmount}
              currentBet={currentBet}
              minRaise={50}
              maxRaise={500}
            />
          )}

          {gameState === 'finished' && (
            <div className="mt-4 sm:mt-6">
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={dealNewHand}
                className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black py-4 sm:py-6 rounded-2xl shadow-2xl text-lg sm:text-xl"
              >
                🔄 NEW HAND
              </motion.button>
            </div>
          )}
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
              className="bg-gradient-to-br from-amber-900 to-amber-950 rounded-3xl p-8 sm:p-12 text-center border-4 border-amber-600 shadow-2xl max-w-md mx-4"
            >
              <div className="text-6xl sm:text-8xl mb-4 sm:mb-6">
                {gameResult.type === 'win' ? '🏆' : gameResult.type === 'lose' ? '😔' : '🤝'}
              </div>
              <h3 className={`text-3xl sm:text-5xl font-black mb-4 sm:mb-6 ${
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

      {/* Mobile Portrait Hint */}
      {!isLandscape && (
        <div className="fixed bottom-20 sm:bottom-4 left-1/2 transform -translate-x-1/2 bg-amber-600/90 backdrop-blur-sm px-3 sm:px-4 py-2 rounded-full text-white text-xs font-bold z-40">
          💡 Rotate device for best experience
        </div>
      )}
    </CasinoTable3D>
  );
}
