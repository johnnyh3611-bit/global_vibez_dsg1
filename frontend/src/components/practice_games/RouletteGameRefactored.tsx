
/**
 * RouletteGameRefactored - Main roulette game component (REFACTORED)
 * Uses modular sub-components for maintainability
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import BackButton from '@/components/BackButton';
import SocialOverlay from '../social/SocialOverlay';
import SocialGameButton from './SocialGameButton';
import { useSocialSocket } from '../../hooks/useSocialSocket';

// Modular Components
import RouletteWheel from '../roulette/RouletteWheel';
import RouletteBettingGrid from '../roulette/RouletteBettingGrid';
import RouletteControls from '../roulette/RouletteControls';
import RouletteStats from '../roulette/RouletteStats';

const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

const getNumberColor = (num) => {
  if (num === 0) return 'green';
  return RED_NUMBERS.includes(num) ? 'red' : 'black';
};

const generateClientSeed = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

export default function RouletteGameRefactored() {
  // Game State
  const [credits, setCredits] = useState(10000);
  const [chipValue, setChipValue] = useState(100);
  const [currentBets, setCurrentBets] = useState([]);
  const [lastRoundBets, setLastRoundBets] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinKey, setSpinKey] = useState(0);
  const [recentNumbers, setRecentNumbers] = useState([]);
  const [lastWinAmount, setLastWinAmount] = useState(0);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [clientSeed] = useState(generateClientSeed());

  // Social State
  const [showSocialOverlay, setShowSocialOverlay] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState([]);

  const API_URL = process.env.REACT_APP_BACKEND_URL;
  const { width, height } = useWindowSize();
  
  // Social WebSocket
  const { isConnected, joinGameRoom, leaveGameRoom } = useSocialSocket('current_user', 'Roulette Player');

  // Join social game room
  useEffect(() => {
    if (!isConnected) return;
    
    joinGameRoom('roulette', 'table_main_1')
      .catch(err => console.error('Failed to join roulette room:', err));
    
    return () => {
      if (isConnected) {
        leaveGameRoom('roulette', 'table_main_1');
      }
    };
  }, [joinGameRoom, leaveGameRoom, isConnected]);

  const fetchNearbyPlayers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/social/nearby-players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'current_user', game_id: 'roulette', table_id: 'table_main_1' })
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
        body: JSON.stringify({ from_user_id: 'current_user', to_user_id: player.id, vibe_type: 'drink', message: 'Great spin! 🎰' })
      });
    } catch (error) {
      // console.error('Failed to send vibe:', error);
    }
  };

  const totalBet = currentBets.reduce((sum, bet) => sum + bet.amount, 0);

  const placeBet = (betType, value) => {
    if (isSpinning || credits < chipValue) return;
    
    const existingBetIndex = currentBets.findIndex(b => b.type === betType && b.value === value);
    if (existingBetIndex >= 0) {
      const updatedBets = [...currentBets];
      updatedBets[existingBetIndex].amount += chipValue;
      setCurrentBets(updatedBets);
    } else {
      setCurrentBets([...currentBets, { id: Date.now(), type: betType, value, amount: chipValue }]);
    }
    setCredits(credits - chipValue);
  };

  const clearBets = () => {
    setCredits(credits + totalBet);
    setCurrentBets([]);
  };

  const repeatLastBet = () => {
    if (lastRoundBets.length === 0 || isSpinning) return;
    
    const totalLastBet = lastRoundBets.reduce((sum, bet) => sum + bet.amount, 0);
    if (credits < totalLastBet) return;
    
    setCurrentBets([...lastRoundBets]);
    setCredits(credits - totalLastBet);
  };

  const spinWheel = async () => {
    if (currentBets.length === 0 || isSpinning) return;

    setIsSpinning(true);
    setLastWinAmount(0);
    setWinningNumber(null);

    try {
      const response = await fetch(`${API_URL}/api/practice/roulette/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          bets: currentBets,
          client_seed: clientSeed
        })
      });

      if (!response.ok) throw new Error('Spin failed');

      const data = await response.json();
      const result = data.result;

      // Calculate wheel rotation
      const numberIndex = WHEEL_NUMBERS.indexOf(result);
      const targetAngle = (numberIndex * 360) / WHEEL_NUMBERS.length;
      const spins = 5;
      const finalRotation = (360 * spins) + targetAngle;

      setWheelRotation(finalRotation);
      setSpinKey(prev => prev + 1);

      // Wait for animation
      await new Promise(resolve => setTimeout(resolve, 3000));

      setWinningNumber(result);
      setRecentNumbers(prev => [result, ...prev].slice(0, 15));
      setIsSpinning(false);

      // Calculate winnings
      const winAmount = data.total_win || 0;
      if (winAmount > 0) {
        setCredits(prev => prev + winAmount);
        setLastWinAmount(winAmount);
        setShowWinAnimation(true);
        setTimeout(() => setShowWinAnimation(false), 5000);
      }

      // Save last round bets
      setLastRoundBets([...currentBets]);
      setCurrentBets([]);

    } catch (error) {
      // console.error('Spin error:', error);
      setIsSpinning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 via-gray-900 to-black relative overflow-hidden">
      <BackButton to="/games" label="Back" variant="casino" />

      {/* Confetti on win */}
      {showWinAnimation && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}

      {/* Social Overlay */}
      <SocialGameButton
        onClick={() => {
          setShowSocialOverlay(true);
          fetchNearbyPlayers();
        }}
        nearbyCount={nearbyPlayers.length}
      />

      {showSocialOverlay && (
        <SocialOverlay
          nearbyPlayers={nearbyPlayers}
          visible={showSocialOverlay}
          onClose={() => setShowSocialOverlay(false)}
          onSendVibe={handleSendVibe}
        />
      )}

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
          {/* Left Column - Wheel & Betting Grid */}
          <div className="space-y-6">
            {/* Wheel */}
            <RouletteWheel
              winningNumber={winningNumber}
              isSpinning={isSpinning}
              wheelRotation={wheelRotation}
              spinKey={spinKey}
            />

            {/* Betting Grid */}
            <RouletteBettingGrid
              onPlaceBet={placeBet}
              currentBets={currentBets}
              isSpinning={isSpinning}
              chipValue={chipValue}
            />
          </div>

          {/* Right Column - Controls & Stats */}
          <div className="space-y-6">
            {/* Controls */}
            <RouletteControls
              credits={credits}
              chipValue={chipValue}
              setChipValue={setChipValue}
              totalBet={totalBet}
              onSpin={spinWheel}
              onClear={clearBets}
              onRepeatBet={repeatLastBet}
              isSpinning={isSpinning}
              hasCurrentBets={currentBets.length > 0}
              hasLastRoundBets={lastRoundBets.length > 0}
            />

            {/* Stats */}
            <RouletteStats recentNumbers={recentNumbers} />
          </div>
        </div>
      </div>

      {/* Win Notification */}
      <AnimatePresence>
        {lastWinAmount > 0 && showWinAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -50 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="bg-gradient-to-br from-amber-600 to-yellow-600 rounded-3xl p-12 shadow-2xl border-4 border-white/30 text-center">
              <p className="text-6xl mb-4">🎊</p>
              <p className="text-white text-4xl font-black mb-2">YOU WIN!</p>
              <p className="text-white text-6xl font-black">${lastWinAmount}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
