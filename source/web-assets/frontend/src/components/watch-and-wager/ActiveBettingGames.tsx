
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Users, Eye, Clock, Gamepad2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API = process.env.REACT_APP_BACKEND_URL;

export function ActiveBettingGames({ gameType = null }) {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchActivePools();
    
    // Refresh every 5 seconds
    const interval = setInterval(fetchActivePools, 5000);
    return () => clearInterval(interval);
  }, [gameType]);

  const fetchActivePools = async () => {
    try {
      const url = gameType 
        ? `${API}/api/watch-and-wager/active-pools?game_type=${gameType}`
        : `${API}/api/watch-and-wager/active-pools`;
      
      const response = await fetch(url, { });
      if (!response.ok) throw new Error('Failed to fetch pools');
      
      const data = await response.json();
      setPools(data.pools || []);
    } catch (error) {
      // console.error('Error fetching betting pools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchAndBet = (gameId) => {
    navigate(`/spectate/${gameId}`);
  };

  const getGameTypeIcon = (type) => {
    switch (type) {
      case 'multiplayer': return '🎮';
      case 'tournament': return '🏆';
      case 'dating': return '❤️';
      default: return '🎲';
    }
  };

  const getGameTypeLabel = (type) => {
    switch (type) {
      case 'multiplayer': return 'Multiplayer';
      case 'tournament': return 'Tournament';
      case 'dating': return 'Dating Game';
      default: return 'Game';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-6xl animate-pulse">🎰</div>
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎮</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Active Games</h3>
        <p className="text-white/60">
          Games with betting will appear here. Check back soon!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {pools.map((pool, idx) => {
        const topOutcome = (Object.entries(pool.predictions || {}) as Array<[string, number]>)
          .sort((a, b) => b[1] - a[1])[0];
        
        return (
          <motion.div
            key={pool.game_id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ scale: 1.02, y: -5 }}
            className="backdrop-blur-xl bg-white/5 border-2 border-white/20 hover:border-fuchsia-400/60 rounded-2xl p-5 cursor-pointer transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.3)]"
            onClick={() => handleWatchAndBet(pool.game_id)}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{getGameTypeIcon(pool.game_type)}</span>
                <div>
                  <div className="text-white font-bold text-sm">
                    {getGameTypeLabel(pool.game_type)}
                  </div>
                  <div className="text-white/60 text-xs">
                    Game #{pool.game_id.slice(-6)}
                  </div>
                </div>
              </div>

              {/* Live Badge */}
              <div className="px-3 py-1 bg-gradient-to-r from-red-600 to-pink-600 rounded-full flex items-center gap-1">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-2 h-2 bg-white rounded-full"
                />
                <span className="text-white text-xs font-bold">LIVE</span>
              </div>
            </div>

            {/* Pool Stats */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="backdrop-blur-xl bg-white/5 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp size={12} className="text-yellow-400" />
                  <span className="text-white/60 text-xs">Pool</span>
                </div>
                <div className="text-white font-bold text-sm">
                  {pool.total_pool.toLocaleString()}
                </div>
                <div className="text-yellow-400 text-xs">
                  ${(pool.total_pool / 1000).toFixed(2)}
                </div>
              </div>

              <div className="backdrop-blur-xl bg-white/5 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-1">
                  <Users size={12} className="text-cyan-400" />
                  <span className="text-white/60 text-xs">Bets</span>
                </div>
                <div className="text-white font-bold text-sm">
                  {pool.bet_count}
                </div>
              </div>

              <div className="backdrop-blur-xl bg-white/5 rounded-lg p-2">
                <div className="flex items-center gap-1 mb-1">
                  <Clock size={12} className="text-green-400" />
                  <span className="text-white/60 text-xs">House</span>
                </div>
                <div className="text-white font-bold text-sm">
                  {pool.house_edge_percent}%
                </div>
              </div>
            </div>

            {/* Top Prediction */}
            {topOutcome && (
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-fuchsia-600/20 to-pink-600/20 border border-fuchsia-400/40">
                <div className="text-white/70 text-xs mb-1">Favorite</div>
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold truncate">
                    {topOutcome[0]}
                  </span>
                  <div className="text-right">
                    <div className="text-fuchsia-300 font-bold">
                      {pool.current_odds?.[topOutcome[0]]?.toFixed(2)}x
                    </div>
                    <div className="text-white/60 text-xs">
                      {((topOutcome[1] / pool.total_pool) * 100).toFixed(0)}% pool
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Watch & Bet Button */}
            <button
              className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold rounded-xl hover:from-fuchsia-500 hover:to-pink-500 transition-all shadow-[0_0_20px_rgba(232,121,249,0.6)] flex items-center justify-center gap-2"
            >
              <Eye size={18} />
              Watch & Bet
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
