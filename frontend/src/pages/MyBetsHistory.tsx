
import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Clock, Trophy, Target, Percent } from 'lucide-react';
import { BigWinCelebration } from '@/components/BigWinCelebration';

const API = process.env.REACT_APP_BACKEND_URL;
const COINS_PER_DOLLAR = 2000;
const BIG_WIN_PROFIT_THRESHOLD = 50; // 50+ coins profit
const BIG_WIN_ODDS_THRESHOLD = 2.5; // 2.5x+ odds

export function MyBetsHistory() {
  const [bets, setBets] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, won, lost
  const [loading, setLoading] = useState(true);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrationReward, setCelebrationReward] = useState(null);
  const previousBetsRef = useRef([]);

  useEffect(() => {
    fetchBets();
    // Poll for new bet updates every 5 seconds
    const interval = setInterval(fetchBets, 5000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchBets = async () => {
    setLoading(true);
    try {
      const url = filter === 'all'
        ? `${API}/api/watch-and-wager/my-bets?limit=100`
        : `${API}/api/watch-and-wager/my-bets?status=${filter}&limit=100`;
      
      const response = await fetch(url, { });
      if (!response.ok) throw new Error('Failed to fetch bets');
      
      const data = await response.json();
      const newBets = data.bets || [];
      
      // Detect new big wins
      detectBigWins(previousBetsRef.current, newBets);
      
      setBets(newBets);
      setStats(data.stats);
      previousBetsRef.current = newBets;
    } catch (error) {
      // console.error('Error fetching bets:', error);
    } finally {
      setLoading(false);
    }
  };

  interface Bet {
    bet_id: string;
    status: string;
    payout: number;
    amount: number;
    odds: number;
    [k: string]: any;
  }
  const detectBigWins = (oldBets: Bet[], newBets: Bet[]) => {
    // Find bets that just changed from pending to won
    const oldBetsMap = new Map(oldBets.map(b => [b.bet_id, b]));
    
    for (const newBet of newBets) {
      const oldBet = oldBetsMap.get(newBet.bet_id);
      
      // Check if bet just won (was pending, now won)
      if (oldBet && oldBet.status === 'pending' && newBet.status === 'won') {
        const profit = newBet.payout - newBet.amount;
        const isBigWin = profit >= BIG_WIN_PROFIT_THRESHOLD || newBet.odds >= BIG_WIN_ODDS_THRESHOLD;
        
        if (isBigWin) {
          // Trigger Big Win Celebration!
          triggerCelebration(newBet);
          break; // Show one celebration at a time
        }
      }
    }
  };

  const triggerCelebration = (bet: any) => {
    const profit = bet.payout - bet.amount;
    const profitPercent = ((profit / bet.amount) * 100).toFixed(0);
    
    setCelebrationReward({
      coins: bet.payout,
      title: profit >= 100 ? 'MASSIVE WIN!' : 'BIG WIN!',
      subtitle: `${bet.odds.toFixed(2)}x ODDS • ${profitPercent}% PROFIT`,
      extraInfo: `You predicted ${bet.prediction} correctly!`,
      onClaim: () => {
        setCelebrationOpen(false);
        // Refresh to show updated balance
        fetchBets();
      }
    });
    setCelebrationOpen(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'won':
        return <span className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold">WON</span>;
      case 'lost':
        return <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold">LOST</span>;
      case 'pending':
        return <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-xs font-bold">PENDING</span>;
      default:
        return <span className="px-3 py-1 bg-gray-600 text-white rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 pt-20 pb-8 px-4">
      {/* Big Win Celebration */}
      <BigWinCelebration 
        isOpen={celebrationOpen}
        onClose={() => setCelebrationOpen(false)}
        reward={celebrationReward}
      />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl font-black text-white mb-2 flex items-center gap-3"
        >
          <Trophy className="w-12 h-12 text-yellow-400" />
          My Bets
        </motion.h1>
        <p className="text-white/70 text-lg mb-8">Track your betting history and performance</p>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="backdrop-blur-xl bg-white/5 border-2 border-white/20 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-cyan-400" />
                <span className="text-white/60 text-sm">Total Bets</span>
              </div>
              <div className="text-white font-black text-3xl">{stats.total_bets}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="backdrop-blur-xl bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-2 border-green-400/40 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-white/60 text-sm">Wins</span>
              </div>
              <div className="text-white font-black text-3xl">{stats.wins}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="backdrop-blur-xl bg-gradient-to-br from-red-600/20 to-pink-600/20 border-2 border-red-400/40 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                <span className="text-white/60 text-sm">Total Profit</span>
              </div>
              <div className={`font-black text-3xl ${stats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.profit >= 0 ? '+' : ''}{stats.profit.toLocaleString()}
              </div>
              <div className={`text-xs ${stats.profit >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                ${(stats.profit / COINS_PER_DOLLAR).toFixed(2)}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="backdrop-blur-xl bg-gradient-to-br from-fuchsia-600/20 to-pink-600/20 border-2 border-fuchsia-400/40 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Percent className="w-5 h-5 text-fuchsia-400" />
                <span className="text-white/60 text-sm">Win Rate</span>
              </div>
              <div className="text-white font-black text-3xl">{stats.win_rate}%</div>
            </motion.div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 backdrop-blur-xl bg-white/5 p-1 rounded-2xl border border-white/10 mb-6 overflow-x-auto">
          {['all', 'pending', 'won', 'lost'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`
                px-6 py-3 rounded-xl font-bold transition-all capitalize flex-shrink-0
                ${filter === status
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(232,121,249,0.6)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Bets List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 animate-pulse">🎰</div>
            <p className="text-white/60">Loading bets...</p>
          </div>
        ) : bets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎲</div>
            <h3 className="text-2xl font-bold text-white mb-2">No Bets Yet</h3>
            <p className="text-white/60">Start betting on live games to see your history here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bets.map((bet, idx) => (
              <motion.div
                key={bet.bet_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="backdrop-blur-xl bg-white/5 border-2 border-white/20 rounded-2xl p-4 hover:border-fuchsia-400/60 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">
                      {bet.game_type === 'multiplayer' && '🎮'}
                      {bet.game_type === 'tournament' && '🏆'}
                      {bet.game_type === 'dating' && '❤️'}
                    </div>
                    <div>
                      <div className="text-white font-bold">
                        Game #{bet.game_id.slice(-6)}
                      </div>
                      <div className="text-white/60 text-xs">
                        <Clock size={12} className="inline mr-1" />
                        {formatDate(bet.created_at)}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(bet.status)}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="backdrop-blur-xl bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Prediction</div>
                    <div className="text-white font-bold text-sm truncate">{bet.prediction}</div>
                  </div>

                  <div className="backdrop-blur-xl bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Bet Amount</div>
                    <div className="text-white font-bold">{bet.amount.toLocaleString()}</div>
                    <div className="text-yellow-400 text-xs">${(bet.amount / COINS_PER_DOLLAR).toFixed(2)}</div>
                  </div>

                  <div className="backdrop-blur-xl bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">Odds</div>
                    <div className="text-fuchsia-300 font-bold">{bet.odds.toFixed(2)}x</div>
                  </div>

                  <div className="backdrop-blur-xl bg-white/5 rounded-lg p-3">
                    <div className="text-white/60 text-xs mb-1">
                      {bet.status === 'won' ? 'Payout' : bet.status === 'pending' ? 'Potential' : 'Lost'}
                    </div>
                    <div className={`font-bold ${bet.status === 'won' ? 'text-green-400' : bet.status === 'pending' ? 'text-white' : 'text-red-400'}`}>
                      {bet.status === 'won' ? bet.payout.toLocaleString() : bet.status === 'pending' ? bet.potential_payout.toLocaleString() : '0'}
                    </div>
                    {bet.status === 'won' && (
                      <div className="text-green-400 text-xs">
                        +{(bet.payout - bet.amount).toLocaleString()} profit
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
