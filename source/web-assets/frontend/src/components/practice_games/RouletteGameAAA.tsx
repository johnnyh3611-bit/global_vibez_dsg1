import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackButton from '@/components/BackButton';
import SocialOverlay from '../social/SocialOverlay';
import SocialGameButton from './SocialGameButton';
import { useSocialSocket } from '../../hooks/useSocialSocket';

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

export default function RouletteGameAAA() {
  const [credits, setCredits] = useState(10000);
  const [chipValue, setChipValue] = useState(100);
  const [currentBets, setCurrentBets] = useState([]);
  const [lastRoundBets, setLastRoundBets] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState(null);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [spinKey, setSpinKey] = useState(0);
  const [recentNumbers, setRecentNumbers] = useState([]); // History of last 15 spins
  const [lastWinAmount, setLastWinAmount] = useState(0);
  const [showWinAnimation, setShowWinAnimation] = useState(false);
  const [clientSeed] = useState(generateClientSeed());

  // Social overlay state
  const [showSocialOverlay, setShowSocialOverlay] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState([]);

  const API_URL = process.env.REACT_APP_BACKEND_URL;
  
  // Social WebSocket
  const { isConnected, joinGameRoom, leaveGameRoom } = useSocialSocket('current_user', 'Roulette Player');

  // Join social game room
  useEffect(() => {
    // Only join room if socket is connected
    if (!isConnected) return;
    
    joinGameRoom('roulette', 'table_main_1')
      .catch(err => {
        // Failed to join social room
      });
    
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

  const doubleBets = () => {
    if (credits < totalBet) return;
    setCurrentBets(currentBets.map(bet => ({ ...bet, amount: bet.amount * 2 })));
    setCredits(credits - totalBet);
  };

  const repeatBets = () => {
    if (lastRoundBets.length === 0) return;
    const repeatTotal = lastRoundBets.reduce((sum, bet) => sum + bet.amount, 0);
    if (credits < repeatTotal) return;
    setCurrentBets([...lastRoundBets]);
    setCredits(credits - repeatTotal);
  };

  const spin = async () => {
    if (isSpinning || totalBet === 0) return;
    setIsSpinning(true);
    setWinningNumber(null);
    setLastRoundBets([...currentBets]);

    try {
      const response = await fetch(`${API_URL}/api/roulette/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSeed })
      });
      const data = await response.json();
      
      const winningIndex = WHEEL_NUMBERS.indexOf(data.winningNumber);
      const pocketAngle = 360 / 37;
      const numberCurrentAngle = winningIndex * pocketAngle;
      
      // Force wheel reset by incrementing key (remounts component)
      setSpinKey(prev => prev + 1);
      setWheelRotation(0);
      
      // Small delay then spin
      setTimeout(() => {
        // Ball is at -90° (top), rotate wheel to align winning number with ball
        // 10 full spins (3600°) - 90° (ball position) - current angle of winning number
        const totalRotation = 3600 - 90 - numberCurrentAngle;
        setWheelRotation(totalRotation);

        setTimeout(() => {
        setWinningNumber(data.winningNumber);
        setIsSpinning(false);
        
        // Add to recent numbers history
        setRecentNumbers(prev => [data.winningNumber, ...prev].slice(0, 15));
        
        let totalWin = 0;
        currentBets.forEach(bet => {
          const num = data.winningNumber;
          
          // Straight up (single number)
          if (bet.type === 'straight' && bet.value === num) totalWin += bet.amount * 36;
          
          // Column bets (2 to 1)
          else if (bet.type === 'column') {
            if (bet.value === 3 && [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].includes(num)) totalWin += bet.amount * 3;
            else if (bet.value === 2 && [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].includes(num)) totalWin += bet.amount * 3;
            else if (bet.value === 1 && [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].includes(num)) totalWin += bet.amount * 3;
          }
          
          // Dozen bets
          else if (bet.type === 'dozen') {
            if (bet.value === '1-12' && num >= 1 && num <= 12) totalWin += bet.amount * 3;
            else if (bet.value === '13-24' && num >= 13 && num <= 24) totalWin += bet.amount * 3;
            else if (bet.value === '25-36' && num >= 25 && num <= 36) totalWin += bet.amount * 3;
          }
          
          // Even money bets
          else if (bet.type === 'red' && getNumberColor(num) === 'red') totalWin += bet.amount * 2;
          else if (bet.type === 'black' && getNumberColor(num) === 'black') totalWin += bet.amount * 2;
          else if (bet.type === 'even' && num % 2 === 0 && num !== 0) totalWin += bet.amount * 2;
          else if (bet.type === 'odd' && num % 2 === 1) totalWin += bet.amount * 2;
          else if (bet.type === 'low' && num >= 1 && num <= 18) totalWin += bet.amount * 2;
          else if (bet.type === 'high' && num >= 19 && num <= 36) totalWin += bet.amount * 2;
        });

        if (totalWin > 0) {
          setCredits(c => c + totalWin);
          setLastWinAmount(totalWin);
          setShowWinAnimation(true);
          setTimeout(() => setShowWinAnimation(false), 3000);
        } else {
          setLastWinAmount(0);
        }
        setTimeout(() => setCurrentBets([]), 2000);
      }, 4000);
      }, 50); // Small delay to ensure reset registers
    } catch (error) {
      setIsSpinning(false);
    }
  };

  const getBetAmount = (type, val) => {
    return currentBets.filter(b => b.type === type && b.value === val).reduce((s, b) => s + b.amount, 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex flex-col">
      <BackButton to="/games" label="← Back" variant="casino" size="small" />

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

      {/* Win Animation Overlay */}
      <AnimatePresence>
        {showWinAnimation && lastWinAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ duration: 0.6, repeat: 3 }}
              className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-black font-black text-6xl px-12 py-8 rounded-2xl shadow-2xl border-4 border-yellow-300"
            >
              🎉 WIN ₵{lastWinAmount.toLocaleString()} 🎉
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD - Credits, Bet & Recent Numbers */}
      <div className="flex justify-end items-center px-6 py-3 bg-black/40 border-b border-white/10 gap-8">
        
        {/* Last Win (only show if > 0) */}
        {lastWinAmount > 0 && (
          <div className="text-center">
            <div className="text-xs text-white/50 uppercase tracking-wider">Last Win</div>
            <div className="text-2xl font-black text-yellow-400">+₵{lastWinAmount.toLocaleString()}</div>
          </div>
        )}
        
        {/* Recent Numbers & Stats Combined */}
        <div className="flex items-center gap-6 bg-black/30 px-4 py-2 rounded-lg border border-white/10">
          {/* Credits & Bet */}
          <div className="flex gap-4 border-r border-white/20 pr-6">
            <div className="text-center">
              <div className="text-xs text-white/50 uppercase tracking-wider">Credits</div>
              <motion.div 
                key={credits}
                initial={{ scale: 1.2, color: '#fbbf24' }}
                animate={{ scale: 1, color: '#10b981' }}
                className="text-xl font-black text-emerald-500"
              >
                ${credits.toLocaleString()}
              </motion.div>
            </div>
            <div className="text-center">
              <div className="text-xs text-white/50 uppercase tracking-wider">Current Bet</div>
              <div className="text-xl font-black text-red-400">${totalBet.toLocaleString()}</div>
            </div>
          </div>
          
          {/* Recent Numbers */}
          <div className="flex items-center gap-2">
            <div className="text-xs text-white/50 uppercase tracking-wider">Recent:</div>
            <div className="flex gap-1">
              {recentNumbers.slice(0, 10).map((num, i) => (
                <motion.div
                  key={`${num}-${i}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    num === 0 ? 'bg-green-600 border-green-400 text-white' :
                    RED_NUMBERS.includes(num) ? 'bg-red-600 border-red-400 text-white' :
                    'bg-black border-white/30 text-white'
                  }`}
                >
                  {num}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CASINO ROULETTE TABLE ROOM - Fully Mobile Responsive */}
      <div className="flex-1 flex flex-col items-center justify-start py-1 sm:py-2 px-1 sm:px-2 md:px-4 overflow-hidden">
        
        {/* ROULETTE WHEEL - Fixed 500x500 for consistent display */}
        <div className="mb-2 sm:mb-4 relative flex justify-center w-full">
          <div 
            style={{ 
              width: '500px',
              height: '500px'
            }} 
            className="relative mx-auto"
          >
            
            {/* Outer wooden circle - 500x500 */}
            <div className="absolute rounded-full" style={{
              width: '500px',
              height: '500px',
              top: '0',
              left: '0',
              background: 'linear-gradient(135deg, #8B4513 0%, #654321 100%)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
            }}>
            </div>
            
            {/* Inner black circle - 460x460, centered in outer circle */}
            <div className="absolute rounded-full" style={{
              width: '460px',
              height: '460px',
              top: '20px',
              left: '20px',
              background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
              boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8)'
            }}>
                
                {/* ROTATING Number Wheel */}
                <motion.div
                  key={spinKey}
                  className="absolute inset-0 rounded-full"
                  initial={{ rotateZ: 0 }}
                  animate={{ rotateZ: wheelRotation }}
                  transition={{ duration: 5, ease: "easeOut" }}
                >
                  {/* All 37 Numbers - Rotate WITH the Wheel */}
                  {WHEEL_NUMBERS.map((num, index) => {
                    const pocketAngle = 360 / 37; // 9.73° per pocket
                    const angle = index * pocketAngle; // Start at 0° (top) for number "0"
                    const color = getNumberColor(num);
                    return (
                      <React.Fragment key={num}>
                        {/* Gold Divider Line - Goes from CENTER (0,0,0) to EDGE through number */}
                        <div 
                          className="absolute left-1/2 top-1/2 origin-left"
                          style={{
                            transform: `rotate(${angle}deg)`,
                            width: '2px',
                            height: '100%',
                            marginLeft: '-1px',
                            marginTop: '-50%',
                            background: 'linear-gradient(to bottom, transparent 0%, transparent 18%, #FFD700 22%, #FFA500 50%, #FFD700 78%, transparent 82%, transparent 100%)',
                            boxShadow: '0 0 3px rgba(255,215,0,0.5)'
                          }}
                        />
                        
                        {/* Number - INSIDE the black disc (460px radius = 230px), positioned at ~195px to stay inside */}
                        <div 
                          className="absolute left-1/2 top-1/2 origin-left"
                          style={{
                            transform: `rotate(${angle}deg) translateX(195px) rotate(${-angle}deg)`,
                            width: '30px',
                            height: '34px',
                            marginLeft: '-15px',
                            marginTop: '-17px'
                          }}
                        >
                          <div 
                            className="w-full h-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ 
                              background: color === 'red' ? '#dc2626' : color === 'black' ? '#000' : '#059669',
                              border: `1px solid ${color === 'red' ? '#7f1d1d' : color === 'black' ? '#1f1f1f' : '#065f46'}`,
                              borderRadius: '2px'
                            }}
                          >
                            {num}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </motion.div>
                
                {/* STATIC Center Circle - Does NOT Rotate */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full flex items-center justify-center z-10" style={{
                  background: winningNumber !== null 
                    ? (getNumberColor(winningNumber) === 'red' ? '#dc2626' : getNumberColor(winningNumber) === 'black' ? '#000' : '#059669')
                    : 'linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #B8860B 100%)',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.7), inset 0 3px 10px rgba(255,255,255,0.3)',
                  border: '4px solid #8B7500',
                  transition: 'all 0.5s ease'
                }}>
                  <div className="text-4xl font-black" style={{
                    color: winningNumber !== null ? '#fff' : '#8B7500'
                  }}>
                    {winningNumber !== null ? winningNumber : 'R'}
                  </div>
                </div>
              </div>
            </div>

            {/* Ball - fixed indicator at top */}
            <div className="absolute top-[70px] left-1/2 transform -translate-x-1/2 z-10">
              <div className="w-5 h-5 rounded-full" style={{ 
                background: 'radial-gradient(circle at 30% 30%, #fff 0%, #e0e0e0 100%)',
                boxShadow: '0 0 20px rgba(255,255,255,1), 0 3px 6px rgba(0,0,0,0.5)'
              }} />
            </div>
          </div>

        {/* BETTING FELT TABLE - Smaller for Better Proportions */}
        <div className="bg-gradient-to-br from-green-800 via-green-900 to-green-950 rounded-xl p-3 shadow-2xl border-4 border-yellow-900" style={{ width: '700px' }}>
          
          {/* Main Grid: 14 columns (1 for 0, 12 for numbers 1-36, 1 for "2 to 1" column bets) + 5 rows */}
          <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'minmax(0, 0.6fr) repeat(12, minmax(0, 1fr)) minmax(0, 0.6fr)' }}>
            
            {/* ROW 1: [0] [3] [6] [9] [12] [15] [18] [21] [24] [27] [30] [33] [36] [2to1] */}
            <button
              onClick={() => placeBet('straight', 0)}
              className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded border border-white/30 text-xs relative"
              style={{ gridRow: '1 / 4', gridColumn: '1' }}
            >
              0
              {getBetAmount('straight', 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded-full border border-white">
                  ₵{getBetAmount('straight', 0)}
                </span>
              )}
            </button>

            {/* Numbers 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36 (Top Row) */}
            {[3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].map((num, idx) => {
              const amt = getBetAmount('straight', num);
              return (
                <button
                  key={num}
                  onClick={() => placeBet('straight', num)}
                  className={`${
                    getNumberColor(num) === 'red' ? 'bg-red-600 hover:bg-red-500' : 'bg-black hover:bg-gray-800'
                  } text-white font-bold py-2 rounded border border-white/30 text-xs relative`}
                  style={{ gridRow: '1', gridColumn: `${idx + 2}` }}
                >
                  {num}
                  {amt > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded-full border border-white">
                      ${amt}
                    </span>
                  )}
                </button>
              );
            })}

            {/* "2 to 1" for top row */}
            <button
              onClick={() => placeBet('column', 3)}
              className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-2 rounded border border-white/30 text-[10px] relative"
              style={{ gridRow: '1', gridColumn: '14' }}
            >
              2:1
              {getBetAmount('column', 3) > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded-full border border-white">
                  ₵{getBetAmount('column', 3)}
                </span>
              )}
            </button>

            {/* ROW 2: [2] [5] [8] [11] [14] [17] [20] [23] [26] [29] [32] [35] [2to1] */}
            {[2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].map((num, idx) => {
              const amt = getBetAmount('straight', num);
              return (
                <button
                  key={num}
                  onClick={() => placeBet('straight', num)}
                  className={`${
                    getNumberColor(num) === 'red' ? 'bg-red-600 hover:bg-red-500' : 'bg-black hover:bg-gray-800'
                  } text-white font-bold py-2 rounded border border-white/30 text-xs relative`}
                  style={{ gridRow: '2', gridColumn: `${idx + 2}` }}
                >
                  {num}
                  {amt > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded-full border border-white">
                      ${amt}
                    </span>
                  )}
                </button>
              );
            })}

            {/* "2 to 1" for middle row */}
            <button
              onClick={() => placeBet('column', 2)}
              className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-2 rounded border border-white/30 text-[10px] relative"
              style={{ gridRow: '2', gridColumn: '14' }}
            >
              2:1
              {getBetAmount('column', 2) > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded-full border border-white">
                  ₵{getBetAmount('column', 2)}
                </span>
              )}
            </button>

            {/* ROW 3: [1] [4] [7] [10] [13] [16] [19] [22] [25] [28] [31] [34] [2to1] */}
            {[1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].map((num, idx) => {
              const amt = getBetAmount('straight', num);
              return (
                <button
                  key={num}
                  onClick={() => placeBet('straight', num)}
                  className={`${
                    getNumberColor(num) === 'red' ? 'bg-red-600 hover:bg-red-500' : 'bg-black hover:bg-gray-800'
                  } text-white font-bold py-2 rounded border border-white/30 text-xs relative`}
                  style={{ gridRow: '3', gridColumn: `${idx + 2}` }}
                >
                  {num}
                  {amt > 0 && (
                    <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded-full border border-white">
                      ${amt}
                    </span>
                  )}
                </button>
              );
            })}

            {/* "2 to 1" for bottom row */}
            <button
              onClick={() => placeBet('column', 1)}
              className="bg-blue-700 hover:bg-blue-600 text-white font-bold py-2 rounded border border-white/30 text-[10px] relative"
              style={{ gridRow: '3', gridColumn: '14' }}
            >
              2:1
              {getBetAmount('column', 1) > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] font-bold px-1 rounded-full border border-white">
                  ₵{getBetAmount('column', 1)}
                </span>
              )}
            </button>

            {/* ROW 4: DOZENS [1st 12] [2nd 12] [3rd 12] spanning 4 columns each */}
            <div style={{ gridRow: '4', gridColumn: '2 / 6' }}>
              <button onClick={() => placeBet('dozen', '1-12')} className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-2 rounded border border-white/30 text-xs relative">
                1st 12
                {getBetAmount('dozen', '1-12') > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] px-1 rounded-full border border-white">
                    ₵{getBetAmount('dozen', '1-12')}
                  </span>
                )}
              </button>
            </div>
            <div style={{ gridRow: '4', gridColumn: '6 / 10' }}>
              <button onClick={() => placeBet('dozen', '13-24')} className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-2 rounded border border-white/30 text-xs relative">
                2nd 12
                {getBetAmount('dozen', '13-24') > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] px-1 rounded-full border border-white">
                    ₵{getBetAmount('dozen', '13-24')}
                  </span>
                )}
              </button>
            </div>
            <div style={{ gridRow: '4', gridColumn: '10 / 14' }}>
              <button onClick={() => placeBet('dozen', '25-36')} className="w-full bg-blue-700 hover:bg-blue-600 text-white font-bold py-2 rounded border border-white/30 text-xs relative">
                3rd 12
                {getBetAmount('dozen', '25-36') > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] px-1 rounded-full border border-white">
                    ₵{getBetAmount('dozen', '25-36')}
                  </span>
                )}
              </button>
            </div>

            {/* ROW 5: EVEN-MONEY BETS [1-18] [EVEN] [RED] [BLACK] [ODD] [19-36] spanning 2 columns each */}
            <div style={{ gridRow: '5', gridColumn: '2 / 4' }}>
              <button onClick={() => placeBet('low', 1)} className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold py-2 rounded border border-white/30 text-xs relative">
                1-18
                {getBetAmount('low', 1) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] px-1 rounded-full border border-white">
                    ₵{getBetAmount('low', 1)}
                  </span>
                )}
              </button>
            </div>
            <div style={{ gridRow: '5', gridColumn: '4 / 6' }}>
              <button onClick={() => placeBet('even', 1)} className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold py-2 rounded border border-white/30 text-xs relative">
                EVEN
                {getBetAmount('even', 1) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] px-1 rounded-full border border-white">
                    ₵{getBetAmount('even', 1)}
                  </span>
                )}
              </button>
            </div>
            <div style={{ gridRow: '5', gridColumn: '6 / 8' }}>
              <button onClick={() => placeBet('red', 1)} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded border border-white/30 text-xs relative">
                RED
                {getBetAmount('red', 1) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] px-1 rounded-full border border-white">
                    ₵{getBetAmount('red', 1)}
                  </span>
                )}
              </button>
            </div>
            <div style={{ gridRow: '5', gridColumn: '8 / 10' }}>
              <button onClick={() => placeBet('black', 1)} className="w-full bg-black hover:bg-gray-900 text-white font-bold py-2 rounded border border-white/30 text-xs relative">
                BLACK
                {getBetAmount('black', 1) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] px-1 rounded-full border border-white">
                    ₵{getBetAmount('black', 1)}
                  </span>
                )}
              </button>
            </div>
            <div style={{ gridRow: '5', gridColumn: '10 / 12' }}>
              <button onClick={() => placeBet('odd', 1)} className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold py-2 rounded border border-white/30 text-xs relative">
                ODD
                {getBetAmount('odd', 1) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] px-1 rounded-full border border-white">
                    ₵{getBetAmount('odd', 1)}
                  </span>
                )}
              </button>
            </div>
            <div style={{ gridRow: '5', gridColumn: '12 / 14' }}>
              <button onClick={() => placeBet('high', 1)} className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold py-2 rounded border border-white/30 text-xs relative">
                19-36
                {getBetAmount('high', 1) > 0 && (
                  <span className="absolute -top-1 -right-1 bg-yellow-400 text-black text-[8px] px-1 rounded-full border border-white">
                    ₵{getBetAmount('high', 1)}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Control Panel - Compact Layout */}
        <div className="mt-4 mb-20 pb-8 flex gap-3 items-center">
          {/* Chips */}
          <div className="flex gap-2">
            {[25, 100, 500, 1000].map(v => (
              <button
                key={v}
                onClick={() => setChipValue(v)}
                className={`w-12 h-12 rounded-full border-4 font-black text-white text-[10px] transition-all shadow-xl ${
                  chipValue === v ? 'scale-110 shadow-2xl' : 'opacity-70 scale-100'
                } ${
                  v === 25 ? 'bg-blue-600 border-blue-300' :
                  v === 100 ? 'bg-red-600 border-red-300' :
                  v === 500 ? 'bg-purple-600 border-purple-300' :
                  'bg-yellow-600 border-yellow-300'
                }`}
              >
                ${v}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button onClick={clearBets} disabled={totalBet === 0} className="bg-red-700 hover:bg-red-600 disabled:opacity-30 text-white font-bold px-4 py-2 rounded-lg text-xs">CLEAR</button>
            <button onClick={doubleBets} disabled={credits < totalBet || totalBet === 0} className="bg-purple-700 hover:bg-purple-600 disabled:opacity-30 text-white font-bold px-4 py-2 rounded-lg text-xs">DOUBLE</button>
            <button onClick={repeatBets} disabled={lastRoundBets.length === 0} className="bg-blue-700 hover:bg-blue-600 disabled:opacity-30 text-white font-bold px-4 py-2 rounded-lg text-xs">REPEAT</button>
            <button onClick={spin} disabled={isSpinning || totalBet === 0} className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-30 text-black font-black px-8 py-2 rounded-lg text-base shadow-2xl">
              {isSpinning ? 'SPINNING...' : 'SPIN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
