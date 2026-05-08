import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Users, Zap, TrendingUp, Trophy } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CommunitySlots() {
  const navigate = useNavigate();
  const [selectedAisle, setSelectedAisle] = useState('aisle_1');
  const [pot, setPot] = useState({ total_pot: 0, contributor_count: 0, pot_level: 'STARTER POT' });
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState(['🍋', '🍋', '🍋', '🍋', '🍋']);
  const [lastResult, setLastResult] = useState(null);
  const [balance, setBalance] = useState(10000); // User's coin balance
  const [betAmount, setBetAmount] = useState(100);
  const wsRef = useRef(null);

  const AISLES = [
    { id: 'aisle_1', name: 'Beginner Alley', minBet: 10 },
    { id: 'aisle_2', name: 'High Roller Lane', minBet: 100 },
    { id: 'aisle_3', name: 'VIP Casino Floor', minBet: 500 }
  ];

  const SYMBOL_EMOJIS = {
    '7': '7️⃣',
    'BAR': '📊',
    'CHERRY': '🍒',
    'LEMON': '🍋',
    'ORANGE': '🍊',
    'PLUM': '🍇',
    'BELL': '🔔',
    'STAR': '⭐'
  };

  useEffect(() => {
    joinAisle(selectedAisle);
    fetchPotStatus(selectedAisle);
    setupWebSocket(selectedAisle);

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedAisle]);

  const setupWebSocket = (aisleId) => {
    const wsUrl = API_URL.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/api/ws/slots/${aisleId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'COMMUNITY_JACKPOT') {
        alert(`🎰 ${data.message}\n\nYou won: ${data.your_share} coins!`);
        setBalance(prev => prev + data.your_share);
        fetchPotStatus(aisleId);
      }
    };

    wsRef.current = ws;
  };

  const joinAisle = async (aisleId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      await fetch(`${API_URL}/api/slots/aisle/${aisleId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: userData.user_id })
      });
    } catch (error) {
      // console.error('Error joining aisle:', error);
    }
  };

  const fetchPotStatus = async (aisleId) => {
    try {
      const response = await fetch(`${API_URL}/api/slots/aisle/${aisleId}/pot`);
      const data = await response.json();
      setPot(data);
    } catch (error) {
      // console.error('Error fetching pot:', error);
    }
  };

  const spinSlots = async () => {
    if (balance < betAmount) {
      alert('Insufficient balance!');
      return;
    }

    setSpinning(true);
    setLastResult(null);

    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      // Animate reels
      const spinDuration = 2000;
      const spinInterval = setInterval(() => {
        setReels(prev => prev.map(() => {
          const symbols = Object.keys(SYMBOL_EMOJIS);
          const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
          return SYMBOL_EMOJIS[randomSymbol];
        }));
      }, 100);

      // Fetch result
      const response = await fetch(`${API_URL}/api/slots/machine/spin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: userData.user_id,
          aisle_id: selectedAisle,
          bet_amount: betAmount
        })
      });

      const data = await response.json();

      // Stop animation and show result
      setTimeout(() => {
        clearInterval(spinInterval);
        const resultReels = data.reels.map(symbol => SYMBOL_EMOJIS[symbol] || '❓');
        setReels(resultReels);
        setLastResult(data);
        setBalance(prev => prev + data.net_result);
        fetchPotStatus(selectedAisle);

        if (data.jackpot_triggered) {
          // WebSocket will handle jackpot notification
        }
      }, spinDuration);

    } catch (error) {
      // console.error('Error spinning:', error);
      alert('Spin failed. Please try again.');
    } finally {
      setTimeout(() => setSpinning(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-blue-900 py-8 px-4">
      <BackButton to="/games" label="Back to Games" variant="default" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent mb-4">
            🎰 Community Slots
          </h1>
          <p className="text-gray-300 text-lg">Play together, win together!</p>
        </div>

        {/* Balance & Aisle Selection */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Balance Card */}
          <div className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm">Your Balance</p>
                <p className="text-4xl font-black text-white">{balance.toLocaleString()}</p>
                <p className="text-yellow-100 text-sm">GV Coins</p>
              </div>
              <Coins className="w-16 h-16 text-yellow-200" />
            </div>
          </div>

          {/* Community Pot Card */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">{pot.pot_level}</p>
                <p className="text-4xl font-black text-white">{pot.total_pot.toLocaleString()}</p>
                <p className="text-purple-100 text-sm flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {pot.contributor_count} contributors
                </p>
              </div>
              <Trophy className="w-16 h-16 text-purple-200" />
            </div>
          </div>
        </div>

        {/* Aisle Selection */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">Select Slot Aisle</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {AISLES.map(aisle => (
              <button
                key={aisle.id}
                onClick={() => setSelectedAisle(aisle.id)}
                className={`p-6 rounded-xl border-2 transition-all ${
                  selectedAisle === aisle.id
                    ? 'bg-cyan-500 border-cyan-400 shadow-lg shadow-cyan-500/50'
                    : 'bg-gray-800 border-gray-600 hover:border-gray-500'
                }`}
              >
                <h3 className="text-xl font-bold text-white mb-2">{aisle.name}</h3>
                <p className="text-gray-300 text-sm">Min Bet: {aisle.minBet} coins</p>
              </button>
            ))}
          </div>
        </div>

        {/* Slot Machine */}
        <div className="bg-gray-900 rounded-3xl p-8 border-4 border-yellow-500 shadow-2xl shadow-yellow-500/30">
          {/* Reels */}
          <div className="flex justify-center gap-4 mb-8">
            {reels.map((symbol, index) => (
              <div
                key={`reel-${index}-${symbol}`}
                className={`w-24 h-32 bg-white rounded-xl flex items-center justify-center text-6xl ${
                  spinning ? 'animate-bounce' : ''
                }`}
              >
                {symbol}
              </div>
            ))}
          </div>

          {/* Last Result */}
          {lastResult && (
            <div className="text-center mb-6">
              <div className={`text-2xl font-bold ${
                lastResult.net_result > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {lastResult.net_result > 0 ? '🎉 WIN!' : '💔 Try Again'}
              </div>
              <p className="text-white text-lg">
                {lastResult.net_result > 0 ? '+' : ''}{lastResult.net_result} coins
              </p>
              {lastResult.jackpot_triggered && (
                <p className="text-yellow-400 text-xl font-bold animate-pulse">
                  {lastResult.jackpot_message}
                </p>
              )}
            </div>
          )}

          {/* Bet Controls */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => setBetAmount(prev => Math.max(10, prev - 50))}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-bold"
            >
              -50
            </button>
            <div className="bg-gray-800 px-8 py-4 rounded-xl">
              <p className="text-gray-400 text-sm">Bet Amount</p>
              <p className="text-white text-3xl font-black">{betAmount}</p>
            </div>
            <button
              onClick={() => setBetAmount(prev => prev + 50)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-bold"
            >
              +50
            </button>
          </div>

          {/* Spin Button */}
          <Button
            onClick={spinSlots}
            disabled={spinning}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black text-2xl font-black py-8 rounded-xl shadow-lg"
          >
            {spinning ? (
              <span className="flex items-center gap-2">
                <Zap className="w-6 h-6 animate-spin" />
                SPINNING...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Zap className="w-6 h-6" />
                SPIN ({betAmount} coins)
              </span>
            )}
          </Button>
        </div>

        {/* Info */}
        <div className="mt-8 bg-gray-800/50 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">How Community Slots Work</h3>
          <ul className="space-y-2 text-gray-300">
            <li className="flex items-start gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>2% of every bet contributes to the community pot</span>
            </li>
            <li className="flex items-start gap-2">
              <Trophy className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <span>Random jackpots split the pot among all contributors</span>
            </li>
            <li className="flex items-start gap-2">
              <Users className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <span>More players = higher jackpot chance!</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
