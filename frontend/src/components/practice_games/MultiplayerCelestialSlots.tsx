
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Heart, Crown, Dices, Tv, Cherry, Star, Users, TrendingUp, Trophy, Zap } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import BackButton from '../BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Symbol configuration matching backend
const SYMBOL_CONFIG = {
  MIDNIGHT_WILD: { name: 'Midnight Wild', icon: Sparkles, color: 'from-cyan-400 to-blue-500', glow: 'cyan', emoji: '💎' },
  CELESTIAL_CROWN: { name: 'Celestial Crown', icon: Crown, color: 'from-yellow-300 to-amber-500', glow: 'amber', emoji: '👑' },
  HEART_VIBE: { name: 'Heart Vibe', icon: Heart, color: 'from-pink-400 to-rose-500', glow: 'pink', emoji: '💝' },
  DICE_PAIR: { name: 'Dice Pair', icon: Dices, color: 'from-purple-400 to-indigo-500', glow: 'purple', emoji: '🎲' },
  LIVE_STREAM: { name: 'Live Stream', icon: Tv, color: 'from-green-400 to-emerald-500', glow: 'green', emoji: '📺' },
  CHERRY: { name: 'Cherry', icon: Cherry, color: 'from-red-400 to-red-600', glow: 'red', emoji: '🍒' },
  STAR: { name: 'Star', icon: Star, color: 'from-orange-400 to-yellow-500', glow: 'orange', emoji: '⭐' }
};

export default function MultiplayerCelestialSlots() {
  const [credits, setCredits] = useState(10000);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [betAmount, setBetAmount] = useState(50);
  const [isSpinning, setIsSpinning] = useState(false);
  const [symbols, setSymbols] = useState(['CHERRY', 'STAR', 'CHERRY', 'STAR', 'CHERRY']);
  const [lastWin, setLastWin] = useState(null);
  const [showJackpot, setShowJackpot] = useState(false);
  const [jackpotAmount, setJackpotAmount] = useState(5000);
  const [playersInRoom, setPlayersInRoom] = useState(0);
  const [recentSpins, setRecentSpins] = useState([]);
  const [teamBonus, setTeamBonus] = useState(1.0);

  const { width, height } = useWindowSize();
  const wsRef = useRef(null);

  // Fetch available rooms
  useEffect(() => {
    fetchRooms();
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!selectedRoom) return;

    const ws = new WebSocket(`${API_URL.replace('http', 'ws')}/api/ws/multiplayer-slots/${selectedRoom.room_id}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'join',
        user_id: 'current_user',
        username: 'Player'
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'joined') {
        setPlayersInRoom(message.data.players_count);
        setJackpotAmount(message.data.jackpot_amount);
      }

      if (message.type === 'player_joined') {
        setPlayersInRoom(message.data.players_count);
      }

      if (message.type === 'player_left') {
        setPlayersInRoom(message.data.players_count);
      }

      if (message.type === 'player_spin') {
        const spinData = message.data;
        
        // Update jackpot pool
        setJackpotAmount(spinData.jackpot_pool_after);
        
        // Add to recent spins feed
        setRecentSpins(prev => [{
          username: spinData.username,
          payout: spinData.final_payout,
          isJackpot: spinData.is_jackpot,
          timestamp: new Date(spinData.timestamp)
        }, ...prev].slice(0, 5));
      }

      if (message.type === 'jackpot_won') {
        setShowJackpot(true);
        setTimeout(() => setShowJackpot(false), 5000);
      }
    };

    ws.onerror = (error) => {
      // console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [selectedRoom]);

  const fetchRooms = async () => {
    try {
      const response = await fetch(`${API_URL}/api/multiplayer-slots/rooms`);
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (error) {
      // console.error('Failed to fetch rooms:', error);
    }
  };

  const handleSpin = async () => {
    if (isSpinning || credits < betAmount) return;

    setIsSpinning(true);
    setCredits(prev => prev - betAmount);

    try {
      const response = await fetch(`${API_URL}/api/multiplayer-slots/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'current_user',
          username: 'Player',
          room_id: selectedRoom.room_id,
          bet_amount: betAmount,
          team_id: null
        })
      });

      const data = await response.json();
      const result = data.result;

      // Animate symbols
      setTimeout(() => {
        setSymbols(result.symbols);
        setTeamBonus(result.team_multiplier);
        
        if (result.final_payout > 0) {
          setLastWin(result.final_payout);
          setCredits(prev => prev + result.final_payout);
        }

        if (result.is_jackpot) {
          setShowJackpot(true);
          setTimeout(() => setShowJackpot(false), 5000);
        }

        setIsSpinning(false);
      }, 2000);

    } catch (error) {
      // console.error('Spin failed:', error);
      setIsSpinning(false);
      setCredits(prev => prev + betAmount); // Refund
    }
  };

  if (!selectedRoom) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
        <BackButton />
        
        <div className="max-w-6xl mx-auto pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 to-pink-500 bg-clip-text text-transparent">
              🎰 Multiplayer Celestial Slots
            </h1>
            <p className="text-xl text-purple-200">Join a room and play with others for shared jackpots!</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <motion.div
                key={room.room_id}
                whileHover={{ scale: 1.02 }}
                className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{room.name}</h3>
                    <p className="text-purple-200 text-sm">
                      {room.players_count}/{room.max_players} Players
                    </p>
                  </div>
                  <Trophy className="text-yellow-400" size={32} />
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-purple-200">Jackpot Pool</span>
                    <span className="text-2xl font-bold text-yellow-400">${room.jackpot_amount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-purple-200">Bet Range</span>
                    <span className="font-semibold">${room.min_bet} - ${room.max_bet}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedRoom(room)}
                  disabled={room.is_full}
                  className={`w-full py-3 rounded-lg font-bold transition-all ${
                    room.is_full
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
                  }`}
                >
                  {room.is_full ? 'Room Full' : 'Join Room'}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4">
      <BackButton onClick={() => setSelectedRoom(null)} />
      
      {showJackpot && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="max-w-7xl mx-auto pt-16">
        {/* Room Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">{selectedRoom.name}</h1>
            <div className="flex items-center gap-4 text-purple-200">
              <span className="flex items-center gap-2">
                <Users size={20} /> {playersInRoom} Players
              </span>
              <span className="flex items-center gap-2">
                <Zap size={20} /> Team Bonus: {teamBonus}x
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-purple-200">Progressive Jackpot</p>
            <motion.p
              key={jackpotAmount}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="text-4xl font-bold text-yellow-400"
            >
              ${jackpotAmount.toLocaleString()}
            </motion.p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Slot Machine */}
          <div className="lg:col-span-2">
            <div className="bg-gradient-to-b from-purple-800/50 to-blue-900/50 backdrop-blur-lg rounded-2xl p-8 border-4 border-yellow-500/30">
              {/* Symbols Display */}
              <div className="grid grid-cols-5 gap-4 mb-8">
                {symbols.map((symbol, idx) => {
                  const config = SYMBOL_CONFIG[symbol];
                  const Icon = config.icon;
                  
                  return (
                    <motion.div
                      key={`${symbol}-${idx}`}
                      animate={isSpinning ? { y: [0, -20, 0], opacity: [1, 0.5, 1] } : {}}
                      transition={{ duration: 0.5, repeat: isSpinning ? Infinity : 0 }}
                      className={`aspect-square bg-gradient-to-br ${config.color} rounded-xl flex items-center justify-center shadow-lg border-2 border-white/30`}
                    >
                      <div className="text-6xl">{config.emoji}</div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Controls */}
              <div className="bg-black/40 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-purple-200 mb-1">Your Credits</p>
                    <p className="text-3xl font-bold">${credits}</p>
                  </div>
                  <div>
                    <p className="text-sm text-purple-200 mb-1">Bet Amount</p>
                    <select
                      value={betAmount}
                      onChange={(e) => setBetAmount(Number(e.target.value))}
                      className="bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-xl font-bold"
                    >
                      {[10, 25, 50, 100, 250].map((bet) => (
                        <option key={bet} value={bet}>${bet}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleSpin}
                  disabled={isSpinning || credits < betAmount}
                  className="w-full py-4 text-2xl font-bold rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSpinning ? 'SPINNING...' : 'SPIN'}
                </button>

                {lastWin && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mt-4 text-center"
                  >
                    <p className="text-3xl font-bold text-yellow-400">+${lastWin}</p>
                    <p className="text-sm text-purple-200">Team Bonus: {teamBonus}x</p>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* Live Feed */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp size={24} />
                Recent Spins
              </h3>

              <div className="space-y-3">
                {recentSpins.length === 0 ? (
                  <p className="text-center text-purple-300 py-8">Waiting for spins...</p>
                ) : (
                  recentSpins.map((spin, idx) => (
                    <motion.div
                      key={`${spin.username}-${idx}`}
                      initial={{ x: 20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className={`p-3 rounded-lg ${
                        spin.isJackpot 
                          ? 'bg-gradient-to-r from-yellow-500 to-amber-600' 
                          : 'bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{spin.username}</span>
                        <span className={`font-bold ${spin.isJackpot ? 'text-2xl' : ''}`}>
                          +${spin.payout}
                        </span>
                      </div>
                      {spin.isJackpot && (
                        <p className="text-xs text-yellow-200 mt-1">🎉 JACKPOT!</p>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <h4 className="font-bold mb-3 text-yellow-400">How It Works</h4>
              <ul className="space-y-2 text-sm text-purple-200">
                <li>✨ 10% of each bet goes to jackpot pool</li>
                <li>👑 5 Celestial Crowns = JACKPOT WIN</li>
                <li>🤝 More players = higher team bonus</li>
                <li>💝 Heart Vibe symbols boost payouts</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Jackpot Win Modal */}
      <AnimatePresence>
        {showJackpot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 180 }}
              className="bg-gradient-to-br from-yellow-400 to-amber-600 rounded-3xl p-12 text-center"
            >
              <Crown size={100} className="mx-auto mb-4 text-yellow-900" />
              <h2 className="text-6xl font-black text-yellow-900 mb-4">JACKPOT!</h2>
              <p className="text-3xl font-bold text-yellow-900">SOMEONE WON THE JACKPOT!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
