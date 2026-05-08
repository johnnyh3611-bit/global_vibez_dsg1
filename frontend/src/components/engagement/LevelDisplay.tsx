import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, Zap, TrendingUp } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function LevelDisplay() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    fetchStats();
    
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API}/api/engagement/profile/stats/${userId}`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      // console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-cyan-500/50 animate-pulse">
        <div className="w-32 h-10 bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      className="relative px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-cyan-500/50 cursor-pointer group"
      whileHover={{ scale: 1.05 }}
      animate={{
        boxShadow: [
          '0 0 20px rgba(6, 182, 212, 0.3)',
          '0 0 40px rgba(6, 182, 212, 0.6)',
          '0 0 20px rgba(6, 182, 212, 0.3)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <div className="flex items-center gap-3">
        {/* Level Icon */}
        <div className="relative">
          <Star className="w-8 h-8 text-yellow-400" fill="currentColor" />
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            <Zap className="w-3 h-3 text-cyan-400 absolute -top-1 -right-1" />
          </motion.div>
        </div>

        {/* Level Info */}
        <div>
          <div className="text-xs text-cyan-300 font-semibold">LEVEL</div>
          <div className="text-2xl font-bold text-white">{stats.level}</div>
        </div>

        {/* XP Progress */}
        <div className="ml-2">
          <div className="text-xs text-gray-400 mb-1 whitespace-nowrap">
            {stats.xp.toLocaleString()} / {stats.next_level_xp.toLocaleString()} XP
          </div>
          <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full relative"
              initial={{ width: 0 }}
              animate={{ width: `${stats.progress_to_next_level}%` }}
              transition={{ duration: 1 }}
            >
              <motion.div
                className="absolute inset-0 bg-white/30"
                animate={{ x: [-100, 200] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Tooltip on Hover */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 bg-black/95 backdrop-blur-xl border border-cyan-500/50 rounded-xl p-4 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        <h4 className="text-sm font-bold text-white mb-2">Your Stats</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Games Won:</span>
            <span className="text-cyan-400 font-semibold">{stats.games_won}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Win Rate:</span>
            <span className="text-purple-400 font-semibold">{stats.win_rate}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Friends:</span>
            <span className="text-pink-400 font-semibold">{stats.friends_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Achievements:</span>
            <span className="text-yellow-400 font-semibold">{stats.achievements_unlocked}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
