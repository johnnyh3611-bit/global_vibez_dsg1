import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Coins, TrendingUp, Gift } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

const API = process.env.REACT_APP_BACKEND_URL;
const COINS_PER_DOLLAR = 2000;  // 2,000 coins = $1
const MIN_CASHOUT_COINS = 50000;  // $25 minimum

export function CoinBalanceWidget({ compact = false }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canClaimDaily, setCanClaimDaily] = useState(true);
  const { success, error: showError } = useToast();

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${API}/api/coins/balance`, {
      });
      
      if (!response.ok) throw new Error('Failed to fetch balance');
      
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      // console.error('Error fetching coin balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimDailyBonus = async () => {
    try {
      const response = await fetch(`${API}/api/coins/daily-bonus`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to claim bonus');
      }

      const data = await response.json();
      success(data.message, 'Daily Bonus!');
      setBalance({ ...balance, coins: data.new_balance });
      setCanClaimDaily(false);
    } catch (error) {
      // console.error('Error claiming daily bonus:', error);
      showError(error.message || 'Already claimed today');
      setCanClaimDaily(false);
    }
  };

  const formatDollarValue = (coins) => {
    return `$${(coins / COINS_PER_DOLLAR).toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="animate-pulse backdrop-blur-xl bg-white/5 rounded-xl p-4">
        <div className="h-8 bg-white/10 rounded"></div>
      </div>
    );
  }

  if (!balance) return null;

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="backdrop-blur-xl bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border-2 border-yellow-400/40 rounded-xl px-4 py-2 cursor-pointer"
        onClick={fetchBalance}
      >
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-400" />
          <div>
            <div className="text-yellow-100 font-bold text-lg">
              {balance.coins.toLocaleString()}
            </div>
            <div className="text-yellow-300/70 text-xs">
              {formatDollarValue(balance.coins)}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="backdrop-blur-xl bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border-2 border-yellow-400/40 rounded-2xl p-6 shadow-[0_0_30px_rgba(251,191,36,0.3)]"
    >
      {/* Balance Display */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-6 h-6 text-yellow-400" />
            <span className="text-white/70 text-sm">Your Balance</span>
          </div>
          <div className="text-4xl font-black text-white mb-1">
            {balance.coins.toLocaleString()}
            <span className="text-yellow-400 ml-2">coins</span>
          </div>
          <div className="text-green-400 text-lg font-bold">
            ≈ {formatDollarValue(balance.coins)}
          </div>
        </div>

        {/* Daily Bonus Button */}
        {canClaimDaily && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={claimDailyBonus}
            className="flex flex-col items-center gap-1 px-4 py-3 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.6)] hover:from-green-500 hover:to-emerald-500 transition-all"
          >
            <Gift className="w-6 h-6 text-white" />
            <span className="text-white text-xs font-bold">Daily<br/>Bonus</span>
          </motion.button>
        )}
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="backdrop-blur-xl bg-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-white/60 text-xs">Earned</span>
          </div>
          <div className="text-white font-bold">
            {balance.lifetime_earned?.toLocaleString() || 0}
          </div>
          <div className="text-green-400/70 text-xs">
            {formatDollarValue(balance.lifetime_earned || 0)}
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Coins className="w-4 h-4 text-red-400" />
            <span className="text-white/60 text-xs">Spent</span>
          </div>
          <div className="text-white font-bold">
            {balance.lifetime_spent?.toLocaleString() || 0}
          </div>
          <div className="text-red-400/70 text-xs">
            {formatDollarValue(balance.lifetime_spent || 0)}
          </div>
        </div>
      </div>

      {/* Cashout Info */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="text-white/60 text-xs mb-2">Cashout Progress</div>
        <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, (balance.coins / MIN_CASHOUT_COINS) * 100)}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-white/60">
            {balance.coins.toLocaleString()} / {MIN_CASHOUT_COINS.toLocaleString()} coins
          </span>
          <span className="text-yellow-400 font-bold">
            Min: $25
          </span>
        </div>
      </div>
    </motion.div>
  );
}
