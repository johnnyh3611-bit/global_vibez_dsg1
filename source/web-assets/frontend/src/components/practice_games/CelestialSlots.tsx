import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Heart, Crown, Dices, Tv, Cherry, Star, Users, TrendingUp } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import CasinoTable3D from '../casino/CasinoTable3D';
import BackButton from '../BackButton';
import SocialOverlay from '../social/SocialOverlay';
import SocialGameButton from './SocialGameButton';
import { useSocialSocket } from '../../hooks/useSocialSocket';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Symbol configuration matching backend
const SYMBOL_CONFIG = {
  MIDNIGHT_WILD: { name: 'Midnight Wild', icon: Sparkles, color: 'from-cyan-400 to-blue-500', glow: 'cyan' },
  CELESTIAL_CROWN: { name: 'Celestial Crown', icon: Crown, color: 'from-yellow-300 to-amber-500', glow: 'amber' },
  HEART_VIBE: { name: 'Heart Vibe', icon: Heart, color: 'from-pink-400 to-rose-500', glow: 'pink' },
  DICE_PAIR: { name: 'Dice Pair', icon: Dices, color: 'from-purple-400 to-indigo-500', glow: 'purple' },
  LIVE_STREAM: { name: 'Live Stream', icon: Tv, color: 'from-green-400 to-emerald-500', glow: 'green' },
  CHERRY: { name: 'Cherry', icon: Cherry, color: 'from-red-400 to-red-600', glow: 'red' },
  STAR: { name: 'Star', icon: Star, color: 'from-orange-400 to-yellow-500', glow: 'orange' }
};

const BET_AMOUNTS = [10, 25, 50, 100, 250, 500, 1000];

export default function CelestialSlots() {
  const [credits, setCredits] = useState(5000);
  const [betAmount, setBetAmount] = useState(50);
  const [isSpinning, setIsSpinning] = useState(false);
  const [symbols, setSymbols] = useState(['CHERRY', 'STAR', 'CHERRY', 'STAR', 'CHERRY']);
  const [lastWin, setLastWin] = useState(null);
  const [showJackpot, setShowJackpot] = useState(false);
  const [spinHistory, setSpinHistory] = useState([]);
  const [autoSpin, setAutoSpin] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);

  // Social overlay state
  const [showSocialOverlay, setShowSocialOverlay] = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState([]);

  const { width, height } = useWindowSize();

  // Social WebSocket
  const { isConnected, joinGameRoom, leaveGameRoom } = useSocialSocket('current_user', 'Slots Player');

  // Join social game room
  useEffect(() => {
    if (!isConnected) return;
    
    joinGameRoom('slots', 'celestial_main_1')
      .catch(err => {
        // Failed to join slots room
      });
    
    return () => {
      if (isConnected) {
        leaveGameRoom('slots', 'celestial_main_1');
      }
    };
  }, [joinGameRoom, leaveGameRoom, isConnected]);

  const fetchNearbyPlayers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/social/nearby-players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'current_user', game_id: 'slots', table_id: 'celestial_main_1' })
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
        body: JSON.stringify({ from_user_id: 'current_user', to_user_id: player.id, vibe_type: 'drink', message: 'Lucky spins! 🎰' })
      });
    } catch (error) {
      // console.error('Failed to send vibe:', error);
    }
  };

  const handleSpin = async () => {
    if (isSpinning || credits < betAmount) return;

    setIsSpinning(true);
    setLastWin(null);

    try {
      // Start spinning animation
      const spinDuration = 2000;
      const interval = setInterval(() => {
        setSymbols(prev => prev.map(() => 
          Object.keys(SYMBOL_CONFIG)[Math.floor(Math.random() * Object.keys(SYMBOL_CONFIG).length)]
        ));
      }, 100);

      // Call backend
      const response = await fetch(`${API_URL}/api/slots/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'current_user',
          bet_amount: betAmount,
          auto_spin: autoSpin
        })
      });

      const result = await response.json();

      // Stop spinning after animation
      setTimeout(() => {
        clearInterval(interval);
        setSymbols(result.symbols);
        
        // Update credits
        const netWin = result.final_payout - betAmount;
        setCredits(prev => prev + netWin);
        
        // Set win info
        if (result.final_payout > 0) {
          setLastWin({
            amount: result.final_payout,
            basePayout: result.base_payout,
            multiplier: result.dating_multiplier,
            nearbyMatches: result.nearby_matches,
            isJackpot: result.is_jackpot
          });

          // Show jackpot celebration
          if (result.is_jackpot) {
            setShowJackpot(true);
            setTimeout(() => setShowJackpot(false), 5000);
          }
        }

        // Add to history
        setSpinHistory(prev => [{
          symbols: result.symbols,
          payout: result.final_payout,
          bet: betAmount,
          timestamp: new Date().toISOString()
        }, ...prev.slice(0, 9)]);

        setIsSpinning(false);

        // Auto spin
        if (autoSpin && credits >= betAmount) {
          setTimeout(() => handleSpin(), 1000);
        }
      }, spinDuration);

    } catch (error) {
      // console.error('Spin error:', error);
      setIsSpinning(false);
    }
  };

  const SymbolDisplay = ({ symbol, index, isResult }) => {
    const config = SYMBOL_CONFIG[symbol];
    const Icon = config.icon;

    return (
      <motion.div
        key={`${symbol}-${index}`}
        initial={isResult ? { scale: 0.8, opacity: 0 } : {}}
        animate={isResult ? { scale: 1, opacity: 1 } : {}}
        transition={{ delay: index * 0.1 }}
        className={`relative flex items-center justify-center h-24 w-24 rounded-xl bg-gradient-to-br ${config.color} shadow-2xl border border-white/20`}
        style={{
          boxShadow: isResult ? `0 0 30px ${config.glow}` : 'none'
        }}
      >
        <Icon className="w-12 h-12 text-white drop-shadow-lg" />
      </motion.div>
    );
  };

  return (
    <CasinoTable3D gameType="slots">
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

      {/* Jackpot Confetti */}
      {showJackpot && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.2}
        />
      )}

      <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex flex-col items-center justify-center p-4">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text mb-2">
            ✨ CELESTIAL SLOTS ✨
          </h1>
          <p className="text-white/60 text-lg">Where Love & Luck Collide</p>
        </motion.div>

        {/* Main Slot Machine */}
        <div className="relative bg-black/40 backdrop-blur-xl border-2 border-cyan-400/30 rounded-3xl p-8 shadow-2xl mb-6"
             style={{ boxShadow: '0 0 60px rgba(6, 182, 212, 0.3)' }}>
          
          {/* Reels */}
          <div className="flex gap-4 mb-6">
            {symbols.map((symbol, index) => (
              <SymbolDisplay
                key={`symbols-${index}`}
                symbol={symbol}
                index={index}
                isResult={!isSpinning}
              />
            ))}
          </div>

          {/* Win Display */}
          <AnimatePresence>
            {lastWin && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -20 }}
                className="absolute -top-20 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-amber-500 to-yellow-400 text-black px-8 py-4 rounded-2xl shadow-2xl border-4 border-yellow-300"
              >
                <div className="text-center">
                  <div className="text-sm font-bold">
                    {lastWin.isJackpot ? '🎊 JACKPOT! 🎊' : '💰 WIN!'}
                  </div>
                  <div className="text-3xl font-black">${lastWin.amount}</div>
                  {lastWin.multiplier > 1.0 && (
                    <div className="text-xs mt-1 text-pink-600 font-bold">
                      💝 Dating Bonus: {lastWin.multiplier.toFixed(2)}x
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          <div className="flex items-center justify-between gap-4">
            {/* Bet Amount */}
            <div className="flex flex-col items-center">
              <span className="text-white/60 text-sm mb-2">Bet Amount</span>
              <div className="flex gap-2">
                {BET_AMOUNTS.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setBetAmount(amount)}
                    disabled={isSpinning}
                    className={`px-4 py-2 rounded-lg font-bold transition ${
                      betAmount === amount
                        ? 'bg-cyan-500 text-white'
                        : 'bg-white/10 text-white/60 hover:bg-white/20'
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Spin Button */}
            <motion.button
              onClick={handleSpin}
              disabled={isSpinning || credits < betAmount}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`relative px-16 py-6 rounded-2xl font-black text-2xl transition shadow-2xl ${
                isSpinning || credits < betAmount
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white hover:shadow-pink-500/50'
              }`}
            >
              {isSpinning ? '🎰 SPINNING...' : '🎰 SPIN'}
            </motion.button>

            {/* Credits */}
            <div className="flex flex-col items-center">
              <span className="text-white/60 text-sm mb-2">Credits</span>
              <div className="text-3xl font-black text-amber-400">
                ${credits.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Auto Spin */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <input
              type="checkbox"
              checked={autoSpin}
              onChange={(e) => setAutoSpin(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-white/80">Auto Spin</span>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full">
          {/* Dating Bonus Info */}
          <div className="bg-pink-500/10 backdrop-blur-md border border-pink-400/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5 text-pink-400" />
              <span className="text-pink-400 font-bold">Dating Bonus</span>
            </div>
            <p className="text-white/60 text-sm">
              Land 💝 Heart Vibe with compatible players nearby for up to <strong>1.5x</strong> payout!
            </p>
          </div>

          {/* Paytable Button */}
          <button
            onClick={() => setShowPaytable(!showPaytable)}
            className="bg-cyan-500/10 backdrop-blur-md border border-cyan-400/30 rounded-xl p-4 hover:bg-cyan-500/20 transition"
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              <span className="text-cyan-400 font-bold">View Paytable</span>
            </div>
          </button>

          {/* Nearby Players */}
          <div className="bg-purple-500/10 backdrop-blur-md border border-purple-400/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="text-purple-400 font-bold">Nearby Players</span>
            </div>
            <p className="text-white/60 text-sm">
              {nearbyPlayers.length} player{nearbyPlayers.length !== 1 ? 's' : ''} at this machine
            </p>
          </div>
        </div>

        {/* Paytable Modal */}
        <AnimatePresence>
          {showPaytable && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowPaytable(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 border-2 border-cyan-400/30 rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              >
                <h2 className="text-3xl font-black text-cyan-400 mb-6">💎 PAYTABLE</h2>
                
                <div className="space-y-4">
                  {Object.entries(SYMBOL_CONFIG).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={key} className="flex items-center justify-between bg-white/5 p-4 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <span className="text-white font-bold">{config.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-amber-400 font-bold">3x: Base • 4x: 2x • 5x: 5x</div>
                          {key === 'HEART_VIBE' && (
                            <div className="text-pink-400 text-sm">+ Dating Bonus</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setShowPaytable(false)}
                  className="mt-6 w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 rounded-lg"
                >
                  Close
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </CasinoTable3D>
  );
}
