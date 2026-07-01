
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, TrendingUp, Crown, DollarSign, Sparkles, Zap, Trophy, Shield, ChevronDown, ChevronUp, X } from 'lucide-react';
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

// Compact Chip Component
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
      data-testid={`chip-${amount}`}
      className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors[amount]} border-2 ${
        selected ? 'border-yellow-400 shadow-[0_0_12px_rgba(255,215,0,0.8)]' : 'border-white/30'
      } flex items-center justify-center font-black text-white text-[11px] shadow-lg transition-all`}
    >
      ₵{amount}
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
  const [assuranceOn, setAssuranceOn] = useState(false);
  const [sideBetsOpen, setSideBetsOpen] = useState(false);
  const [recentRollsOpen, setRecentRollsOpen] = useState(false);
  
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
        
        // Auto-credit demo balance if user has 0 coins
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
      alert(`Insufficient balance! You have ₵${balance.toFixed(2)} but need ₵${selectedChip}. Click "Top Up" to add credits.`);
      return;
    }
    if (gameState.status === 'betting') {
      setMainBet(prev => prev + selectedChip);
      setBalance(prev => prev - selectedChip);
    }
  };

  const handleSideBet = (betId) => {
    if (selectedChip > balance) {
      alert(`Insufficient balance! You have ₵${balance.toFixed(2)} but need ₵${selectedChip}. Click "Top Up" to add credits.`);
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

      <div className="max-w-5xl mx-auto p-6 space-y-6">
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
                            <p className="text-sm text-yellow-300 mt-2">Dealer Envy: ₵{gameState.dealerEnvy}</p>
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

          {/* COMPACT BETTING CONTROL STRIP */}
          <div className="bg-gradient-to-br from-black/80 to-purple-900/20 border border-purple-500/30 rounded-2xl p-4 space-y-3">
            {/* Row 1: Chip Strip + Assurance */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase tracking-wider text-purple-300 mr-1">Chip</span>
              {[5, 10, 25, 50, 100].map(amt => (
                <BettingChip
                  key={amt}
                  amount={amt}
                  selected={selectedChip === amt}
                  onClick={() => setSelectedChip(amt)}
                />
              ))}
              <button
                data-testid="assurance-toggle"
                onClick={() => setAssuranceOn(v => !v)}
                className={`ml-2 h-10 px-3 rounded-full text-[11px] font-black uppercase tracking-wide border-2 flex items-center gap-1 transition-all ${
                  assuranceOn
                    ? 'bg-gradient-to-br from-yellow-500 to-amber-600 border-yellow-300 text-black shadow-[0_0_12px_rgba(255,215,0,0.6)]'
                    : 'bg-black/60 border-white/20 text-gray-300 hover:border-yellow-400/50'
                }`}
                title="Assurance: side-bet protection pays 1:1 if you bust"
              >
                <Shield className="w-3.5 h-3.5" />
                Assurance
              </button>
            </div>

            {/* Row 2: Main Bet + Roll + Clear + Side Bets dropdown trigger */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleMainBet}
                data-testid="main-bet-pad"
                disabled={gameState.status !== 'betting'}
                className="flex-1 min-w-[140px] bg-gradient-to-br from-purple-600 to-pink-600 border-2 border-purple-400 rounded-xl px-4 py-2 text-left hover:scale-[1.02] transition-transform disabled:opacity-60"
              >
                <p className="text-[10px] uppercase tracking-wider text-purple-200">Main Bet (Required)</p>
                <p className="text-xl font-black leading-tight">₵{mainBet.toLocaleString()}</p>
              </button>

              <Button
                onClick={rollDice}
                disabled={mainBet === 0 || gameState.status !== 'betting'}
                data-testid="roll-dice-btn"
                className="h-12 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 font-black px-5 disabled:opacity-50"
              >
                <Dices className="w-4 h-4 mr-1" /> ROLL
              </Button>

              <Button
                onClick={clearBets}
                data-testid="clear-bets-btn"
                variant="outline"
                size="sm"
                className="h-12 border-red-500 text-red-500 hover:bg-red-500/10 px-3"
                disabled={mainBet === 0 && Object.keys(sideBets).length === 0}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>

              <button
                onClick={() => setSideBetsOpen(v => !v)}
                data-testid="side-bets-toggle"
                className="h-12 px-3 rounded-md bg-black/60 border border-purple-500/40 hover:border-purple-400 text-sm font-bold flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                Side Bets
                {Object.keys(sideBets).length > 0 && (
                  <span className="ml-1 text-[10px] bg-yellow-400 text-black rounded-full px-1.5 py-0.5 font-black">
                    {Object.keys(sideBets).length}
                  </span>
                )}
                {sideBetsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Side Bets dropdown panel */}
            <AnimatePresence>
              {sideBetsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-purple-500/20">
                    {sideBetOptions.map(bet => (
                      <button
                        key={bet.id}
                        onClick={() => handleSideBet(bet.id)}
                        data-testid={`sidebet-${bet.id}`}
                        className="text-left bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/20 rounded-lg p-2 cursor-pointer hover:border-purple-400 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <p className="font-bold text-xs">{bet.name}</p>
                          <span className="text-yellow-400 text-[10px] font-black">{bet.payout}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">{bet.description}</p>
                        {sideBets[bet.id] > 0 && (
                          <p className="text-[10px] text-green-400 mt-0.5">Bet: ₵{sideBets[bet.id]}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {gameState.status === 'result' && (
              <Button onClick={newRound} data-testid="new-round-btn" className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                New Round
              </Button>
            )}
          </div>

          {/* Recent Rolls Collapsible Bar */}
          <div className="bg-black/60 border border-purple-500/30 rounded-xl overflow-hidden">
            <button
              onClick={() => setRecentRollsOpen(v => !v)}
              data-testid="recent-rolls-toggle"
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Recent Rolls
                {rollHistory.length > 0 && (
                  <span className="text-[10px] bg-purple-500/30 text-purple-200 rounded-full px-2 py-0.5">
                    {rollHistory.length}
                  </span>
                )}
              </span>
              {recentRollsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <AnimatePresence>
              {recentRollsOpen && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-purple-500/20"
                >
                  <div className="p-3 max-h-[300px] overflow-y-auto">
                    {rollHistory.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">No rolls yet</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {rollHistory.map((roll, idx) => (
                          <div key={`roll-${idx}-${roll.game_result?.point || idx}`} className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-2">
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
                                <div key={`dice-${idx}-${i}`} className="w-6 h-6 bg-red-600 rounded text-xs flex items-center justify-center font-bold">
                                  {val}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
