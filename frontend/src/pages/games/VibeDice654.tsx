
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, TrendingUp, Crown, DollarSign, Sparkles, Zap, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MetaHumanDealer from '@/components/MetaHumanDealer';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Dice Component
const Dice = ({ value, rolling }) => {
  const dotPositions = {
    1: [[50, 50]],
    2: [[25, 25], [75, 75]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[25, 25], [25, 75], [75, 25], [75, 75]],
    5: [[25, 25], [25, 75], [50, 50], [75, 25], [75, 75]],
    6: [[25, 25], [25, 50], [25, 75], [75, 25], [75, 50], [75, 75]]
  } as Record<number, number[][]>;

  return (
    <motion.div
      className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-800 rounded-xl border-2 border-red-400 shadow-2xl relative"
      animate={rolling ? {
        rotateX: [0, 360, 720],
        rotateY: [0, 360, 720],
        scale: [1, 1.2, 1]
      } : {}}
      transition={{ duration: 1, ease: "easeOut" }}
    >
      {dotPositions[value]?.map((pos, i) => (
        <div
          key={`item-${i}-${Math.random()}`}
          className="absolute w-3 h-3 bg-white rounded-full"
          style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, transform: 'translate(-50%, -50%)' }}
        />
      ))}
    </motion.div>
  );
};

// Chip Component
const BettingChip = ({ amount, selected, onClick }) => {
  const colors: Record<number, string> = {
    5: 'from-blue-500 to-blue-700',
    10: 'from-green-500 to-green-700',
    25: 'from-purple-500 to-purple-700',
    50: 'from-orange-500 to-orange-700',
    100: 'from-yellow-500 to-yellow-700',
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={`w-14 h-14 rounded-full bg-gradient-to-br ${colors[amount]} border-4 ${
        selected ? 'border-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.8)]' : 'border-white/30'
      } flex items-center justify-center font-black text-white text-sm shadow-xl transition-all`}
    >
      ${amount}
    </motion.button>
  );
};

export default function VibeDice654() {
  const navigate = useNavigate();
  const [userId] = useState('test_user_dice');
  const [balance, setBalance] = useState(1000);
  const [mainBet, setMainBet] = useState(0);
  const [sideBets, setSideBets] = useState<Record<string, number>>({});
  const [selectedChip, setSelectedChip] = useState(10);
  interface VibeDiceGameState {
    status: string;
    rolls: any[];
    qualified: boolean;
    point: number;
    dealerEnvy: number;
    sideBetResults?: any;
  }
  const [gameState, setGameState] = useState<VibeDiceGameState>({
    status: 'betting', // betting, rolling, result
    rolls: [],
    qualified: false,
    point: 0,
    dealerEnvy: 0
  });
  const [rollHistory, setRollHistory] = useState([]);
  const [dealerStats, setDealerStats] = useState({ total_hands: 0, total_envy: 0 });
  
  // Side bet options
  const sideBetOptions = [
    { id: 'TRIPLE_6', name: 'Triple 6', payout: '30:1', description: '3+ sixes' },
    { id: 'ONE_AND_DONE', name: 'One & Done', payout: '10:1', description: '6-5-4 first roll' },
    { id: 'STRAIGHT_1', name: 'Straight 1s', payout: '500:1', description: 'Five 1s' },
    { id: 'STRAIGHT_6', name: 'Straight 6s', payout: '500:1', description: 'Five 6s' },
    { id: 'LARGE_STRAIGHT', name: 'Large Straight', payout: '100:1', description: '1-2-3-4-5 or 2-3-4-5-6' },
  ];

  // Fetch wallet balance
  useEffect(() => {
    fetchBalance();
    fetchDealerStats();
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wallet/balance/${userId}`);
      const data = await res.json();
      if (data.success) {
        setBalance(data.balance);
        
        // Auto-credit demo balance if user has $0
        if (data.balance === 0) {
          const creditRes = await fetch(`${API_URL}/api/wallet/credit/${userId}?amount=1000`, {
            method: 'POST'
          });
          const creditData = await creditRes.json();
          if (creditData.success) {
            setBalance(creditData.balance);
          }
        }
      }
    } catch (err) {
      // console.error('Error fetching balance:', err);
    }
  };

  const fetchDealerStats = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dice/leaderboard/dealer-envy`);
      const data = await res.json();
      if (data.success && data.rankings.length > 0) {
        const nova = data.rankings.find(d => d.personality_id === 'NOVA');
        if (nova) {
          setDealerStats({
            total_hands: nova.total_hands_dealt || 0,
            total_envy: nova.total_envy_collected || 0
          });
        }
      }
    } catch (err) {
      // console.error('Error fetching dealer stats:', err);
    }
  };

  const handleMainBet = () => {
    if (selectedChip > balance) {
      alert(`Insufficient balance! You have $${balance.toFixed(2)} but need $${selectedChip}. Click "Top Up" to add credits.`);
      return;
    }
    if (gameState.status === 'betting') {
      setMainBet(prev => prev + selectedChip);
      setBalance(prev => prev - selectedChip);
    }
  };

  const handleSideBet = (betId) => {
    if (selectedChip > balance) {
      alert(`Insufficient balance! You have $${balance.toFixed(2)} but need $${selectedChip}. Click "Top Up" to add credits.`);
      return;
    }
    if (gameState.status === 'betting') {
      setSideBets(prev => ({
        ...prev,
        [betId]: (prev[betId] || 0) + selectedChip
      }));
      setBalance(prev => prev - selectedChip);
    }
  };

  const clearBets = () => {
    const totalBets = mainBet + (Object.values(sideBets) as number[]).reduce((a, b) => a + b, 0);
    setBalance(prev => prev + totalBets);
    setMainBet(0);
    setSideBets({});
  };

  const rollDice = async () => {
    if (mainBet === 0) {
      alert('Place a main bet first!');
      return;
    }

    setGameState(prev => ({ ...prev, status: 'rolling' }));

    try {
      const sideBetsArray = Object.entries(sideBets).map(([type, amount]) => ({
        type,
        amount
      }));

      const res = await fetch(`${API_URL}/api/dice/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          main_bet: mainBet,
          side_bets: sideBetsArray,
          dealer_personality: 'nova'
        })
      });

      const data = await res.json();

      if (data.success) {
        // Animate dice rolls
        setTimeout(() => {
          setGameState({
            status: 'result',
            rolls: data.game_result.rolls,
            qualified: data.game_result.status === 'QUALIFIED',
            point: data.game_result.point || 0,
            dealerEnvy: data.dealer_envy_total,
            sideBetResults: data.side_bet_results
          });

          // Calculate winnings
          if (data.game_result.status === 'QUALIFIED') {
            const winnings = data.pot_info.winner_payout;
            const sideBetWinnings = data.side_bet_results.reduce((sum, bet) => sum + bet.payout, 0);
            setBalance(prev => prev + winnings + sideBetWinnings);
          }

          // Add to history
          setRollHistory(prev => [data, ...prev].slice(0, 10));
          
          // Update dealer stats
          fetchDealerStats();
        }, 2000);
      }
    } catch (err) {
      // console.error('Error rolling dice:', err);
      setGameState(prev => ({ ...prev, status: 'betting' }));
    }
  };

  const newRound = () => {
    setMainBet(0);
    setSideBets({});
    setGameState({ status: 'betting', rolls: [], qualified: false, point: 0, dealerEnvy: 0 });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-purple-900/20 to-transparent border-b border-white/10 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Dices className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-2xl font-black">VIBEZ 654</h1>
              <p className="text-sm text-purple-400">Underground Craps Club</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-gray-400">Balance</p>
              <p className="text-2xl font-black text-green-400">₵{Math.round(balance).toLocaleString()}</p>
            </div>
            <Button onClick={() => navigate('/wallet')} className="bg-gradient-to-r from-green-600 to-emerald-600">
              <DollarSign className="w-4 h-4 mr-2" /> Top Up
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid lg:grid-cols-[1fr_400px] gap-6">
        {/* Main Game Area */}
        <div className="space-y-6">
          {/* Dealer */}
          <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 rounded-3xl border border-purple-500/30 p-6">
            <MetaHumanDealer
              dealerType="nova"
              gameType="default"
              gameState={{
                isDealing: gameState.status === 'rolling',
                playerWon: gameState.qualified,
                playerLost: !gameState.qualified && gameState.status === 'result'
              }}
              size="normal"
            />
            
            {/* Dealer Stats */}
            <div className="mt-4 flex justify-center gap-6 text-center">
              <div>
                <p className="text-xs text-purple-300">Hands Dealt</p>
                <p className="text-xl font-black">{dealerStats.total_hands}</p>
              </div>
              <div>
                <p className="text-xs text-pink-300">Dealer Envy</p>
                <p className="text-xl font-black text-yellow-400">₵{Math.round(dealerStats.total_envy).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Dice Area */}
          <div className="bg-black/60 border-2 border-purple-500/30 rounded-3xl p-8 min-h-[300px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {gameState.rolls.length > 0 && (
                <div className="space-y-4 w-full">
                  {gameState.rolls.map((roll, idx) => (
                    <motion.div
                      key={`item-${idx}-${Date.now()}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 justify-center"
                    >
                      {roll.map((value, i) => (
                        <Dice key={`item-${i}-${Math.random()}`} value={value} rolling={gameState.status === 'rolling'} />
                      ))}
                    </motion.div>
                  ))}
                  
                  {gameState.status === 'result' && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="text-center mt-6"
                    >
                      {gameState.qualified ? (
                        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 border-2 border-green-400">
                          <Trophy className="w-12 h-12 text-yellow-400 mx-auto mb-2" />
                          <h3 className="text-3xl font-black text-yellow-400">QUALIFIED!</h3>
                          <p className="text-xl mt-2">Point: <span className="font-black">{gameState.point}</span></p>
                          {gameState.dealerEnvy > 0 && (
                            <p className="text-sm text-yellow-300 mt-2">Dealer Envy: ${gameState.dealerEnvy}</p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl p-6 border-2 border-red-400">
                          <h3 className="text-3xl font-black">BUST!</h3>
                          <p className="text-lg mt-2">Better luck next roll!</p>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              )}
              
              {gameState.rolls.length === 0 && (
                <div className="text-center">
                  <Dices className="w-24 h-24 text-purple-400/30 mx-auto mb-4" />
                  <p className="text-gray-500">Place your bets and roll!</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Betting Controls */}
          <div className="bg-gradient-to-br from-black/80 to-purple-900/20 border border-purple-500/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Select Chip Value</h3>
              <div className="flex gap-2">
                {[5, 10, 25, 50, 100].map(amt => (
                  <BettingChip
                    key={amt}
                    amount={amt}
                    selected={selectedChip === amt}
                    onClick={() => setSelectedChip(amt)}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Main Bet (Required)</label>
                <div
                  onClick={handleMainBet}
                  className="bg-gradient-to-br from-purple-600 to-pink-600 border-2 border-purple-400 rounded-xl p-4 text-center cursor-pointer hover:scale-105 transition-transform"
                >
                  <p className="text-2xl font-black">₵{mainBet.toLocaleString()}</p>
                  <p className="text-xs text-purple-200">Click to add chip</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={rollDice}
                  disabled={mainBet === 0 || gameState.status !== 'betting'}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-lg font-black disabled:opacity-50"
                >
                  <Dices className="w-5 h-5 mr-2" /> ROLL DICE
                </Button>
                <Button
                  onClick={clearBets}
                  variant="outline"
                  className="border-red-500 text-red-500 hover:bg-red-500/10"
                  disabled={mainBet === 0 && Object.keys(sideBets).length === 0}
                >
                  Clear Bets
                </Button>
              </div>
            </div>

            {gameState.status === 'result' && (
              <Button onClick={newRound} className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                New Round
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Side Bets */}
          <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-4">
            <h3 className="text-lg font-black mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-400" /> Side Bets
            </h3>
            <div className="space-y-2">
              {sideBetOptions.map(bet => (
                <div
                  key={bet.id}
                  onClick={() => handleSideBet(bet.id)}
                  className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/20 rounded-lg p-3 cursor-pointer hover:border-purple-400 transition-all"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-bold text-sm">{bet.name}</p>
                    <span className="text-yellow-400 text-xs font-black">{bet.payout}</span>
                  </div>
                  <p className="text-xs text-gray-400">{bet.description}</p>
                  {sideBets[bet.id] > 0 && (
                    <p className="text-xs text-green-400 mt-1">Bet: ${sideBets[bet.id]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Rolls */}
          <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-4 max-h-[400px] overflow-y-auto">
            <h3 className="text-lg font-black mb-3">Recent Rolls</h3>
            {rollHistory.length === 0 ? (
              <p className="text-gray-500 text-sm">No rolls yet</p>
            ) : (
              <div className="space-y-2">
                {rollHistory.map((roll, idx) => (
                  <div key={`item-${idx}-${Date.now()}`} className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className={`text-xs font-bold ${roll.game_result.status === 'QUALIFIED' ? 'text-green-400' : 'text-red-400'}`}>
                        {roll.game_result.status}
                      </span>
                      {roll.game_result.point > 0 && (
                        <span className="text-xs text-yellow-400">Point: {roll.game_result.point}</span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {roll.game_result.rolls[0]?.map((val, i) => (
                        <div key={`item-${i}-${Math.random()}`} className="w-6 h-6 bg-red-600 rounded text-xs flex items-center justify-center font-bold">
                          {val}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
