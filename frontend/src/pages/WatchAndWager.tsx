import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Coins, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CoinBalanceWidget } from '@/components/watch-and-wager/CoinBalanceWidget';
import { ActiveBettingGames } from '@/components/watch-and-wager/ActiveBettingGames';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ToastNotification';

export function WatchAndWager() {
  const [selectedTab, setSelectedTab] = useState('all'); // all, multiplayer, tournament, dating
  const { toasts, removeToast } = useToast();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 pt-20 pb-8 px-4">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-black text-white mb-2 flex items-center gap-3"
          >
            <Trophy className="w-12 h-12 text-yellow-400" />
            Watch & Wager
          </motion.h1>
          <p className="text-white/70 text-lg">
            Bet on live games • Watch the action • Win coins 🎰
          </p>
        </div>

        {/* Top Section - Balance + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Coin Balance */}
          <div className="lg:col-span-2">
            <CoinBalanceWidget />
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/my-bets')}
              className="w-full backdrop-blur-xl bg-gradient-to-br from-fuchsia-600/20 to-pink-600/20 border-2 border-fuchsia-400/40 rounded-2xl p-4 hover:from-fuchsia-600/30 hover:to-pink-600/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <History className="w-8 h-8 text-fuchsia-400" />
                <div className="text-left">
                  <div className="text-white font-bold">My Bets</div>
                  <div className="text-white/60 text-sm">View history</div>
                </div>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/coins/leaderboard')}
              className="w-full backdrop-blur-xl bg-gradient-to-br from-green-600/20 to-emerald-600/20 border-2 border-green-400/40 rounded-2xl p-4 hover:from-green-600/30 hover:to-emerald-600/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-8 h-8 text-green-400" />
                <div className="text-left">
                  <div className="text-white font-bold">Leaderboard</div>
                  <div className="text-white/60 text-sm">Top earners</div>
                </div>
              </div>
            </motion.button>
          </div>
        </div>

        {/* Game Type Tabs */}
        <div className="flex gap-2 backdrop-blur-xl bg-white/5 p-1 rounded-2xl border border-white/10 mb-6 overflow-x-auto">
          {[
            { id: 'all', label: 'All Games', icon: '🎲' },
            { id: 'multiplayer', label: 'Multiplayer', icon: '🎮' },
            { id: 'tournament', label: 'Tournaments', icon: '🏆' },
            { id: 'dating', label: 'Dating Games', icon: '❤️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`
                px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 flex-shrink-0
                ${selectedTab === tab.id
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white shadow-[0_0_20px_rgba(232,121,249,0.6)]'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
              `}
            >
              <span className="text-xl">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Info Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="backdrop-blur-xl bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-2 border-cyan-400/40 rounded-2xl p-4 mb-6"
        >
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h3 className="text-white font-bold mb-1">How It Works</h3>
              <ul className="text-white/80 text-sm space-y-1">
                <li>• <strong>Community Odds:</strong> Odds change based on how others bet</li>
                <li>• <strong>5% House Edge:</strong> We take 5%, winners share the rest</li>
                <li>• <strong>Bet Limits:</strong> Min 10 ₵, Max 100 ₵ per wager</li>
                <li>• <strong>Fair System:</strong> Underdogs get better odds automatically</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Active Betting Games */}
        <div>
          <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-2">
            <span className="text-3xl">🎮</span>
            Live Games to Bet On
          </h2>
          <ActiveBettingGames gameType={selectedTab === 'all' ? null : selectedTab} />
        </div>
      </div>
    </div>
  );
}
