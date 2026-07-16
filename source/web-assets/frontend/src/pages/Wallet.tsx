import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet as WalletIcon, DollarSign, TrendingUp, ArrowUpRight, ArrowDownLeft, Clock, Sparkles, Loader2 } from 'lucide-react';
import UnifiedNavigation from '../components/hub/UnifiedNavigation';
import PayoutRequestModal from '../components/payout/PayoutRequestModal';
import PendingPayouts from '../components/payout/PendingPayouts';
import PhantomConnectButton from '../components/web3/PhantomConnectButton';
import TopUpVibezCoinsModal from '@/components/wallet/TopUpVibezCoinsModal';
import { GlobalCard } from '@/components/ui/GlobalCard';
import { getBackendUrl } from '@/config/backendUrl';

const API_URL = getBackendUrl();
const COINS_PER_USD = 1000;
const MIN_PAYOUT_COINS = 20000;

interface UserProfile {
  user_id: string;
  name: string;
  credits_balance: number;
  picture?: string;
}

const Wallet = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [userBalance, setUserBalance] = useState(0);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
          setError('Please sign in to view your wallet.');
          setLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Failed to load profile');
        }

        const data: UserProfile = await response.json();
        setUser(data);
        setUserBalance(data.credits_balance ?? 0);
        setUserId(data.user_id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load wallet');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handlePayoutRequest = async (payoutData: { coin_amount: number }) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/v1/payout/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          user_id: userId,
          ...payoutData
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}\n\nReward ID: ${result.payout_id}\nAmount: $${result.net_payout.toFixed(2)}\nRelease Date: ${new Date(result.release_date).toLocaleString()}`);

        setUserBalance(prev => prev - payoutData.coin_amount);
        setRefreshTrigger(prev => prev + 1);
      } else {
        const error = await response.json();
        alert(`❌ Reward failed: ${error.detail}`);
      }
    } catch (error) {
      console.error('Reward request failed:', error);
      alert('Failed to process reward request');
    }
  };

  const handleCancelPayout = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const usdEquivalent = (userBalance / COINS_PER_USD).toFixed(2);
  const minCashoutUsd = (MIN_PAYOUT_COINS / COINS_PER_USD).toFixed(2);

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      <UnifiedNavigation />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-cyan-400 text-sm font-bold">Vibez Coins Wallet</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-4">
            Your Balance
          </h1>
          <p className="text-white/60 text-lg">Manage your Vibez Coins and cash out earnings</p>
        </motion.div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-white/60">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading wallet…
          </div>
        )}

        {error && !loading && (
          <div className="mb-8 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center text-rose-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Balance Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-gradient-to-br from-cyan-600 via-purple-600 to-pink-600 rounded-3xl p-8 mb-8 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <WalletIcon className="w-8 h-8 text-white" />
                <p className="text-white/90 text-lg font-semibold">Available Balance</p>
              </div>

              <div className="mb-6">
                <p className="text-white text-6xl font-black mb-2">
                  ₵{userBalance.toLocaleString()}
                </p>
                <p className="text-white/80 text-2xl font-semibold">
                  ≈ ${usdEquivalent} USD
                </p>
                <p className="text-white/60 text-sm mt-2">1 USD = ₵{COINS_PER_USD.toLocaleString()} Vibez Coins</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => setShowTopUpModal(true)}
                  data-testid="wallet-buy-coins-btn"
                  className="bg-white text-purple-700 hover:bg-white/90 font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Buy Coins
                </button>
                <button
                  onClick={() => navigate('/games')}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  Earn More
                </button>
                <button
                  onClick={() => setShowPayoutModal(true)}
                  disabled={userBalance < MIN_PAYOUT_COINS}
                  className={`font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2 ${
                    userBalance >= MIN_PAYOUT_COINS
                      ? 'bg-white/90 text-purple-600 hover:bg-white'
                      : 'bg-white/10 text-white/40 cursor-not-allowed'
                  }`}
                >
                  <DollarSign className="w-5 h-5" />
                  Cash Out
                </button>
              </div>

              {userBalance < MIN_PAYOUT_COINS && (
                <p className="text-white/60 text-xs text-center mt-3">
                  Minimum cashout: ₵{MIN_PAYOUT_COINS.toLocaleString()} (${minCashoutUsd})
                </p>
              )}
            </motion.div>

            {/* Connect Phantom wallet — post-login linking. */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-8 rounded-2xl border border-purple-500/30 bg-black/40 backdrop-blur p-5 flex flex-col sm:flex-row items-center justify-between gap-3"
              data-testid="wallet-connect-phantom-row"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-2xl">
                  👻
                </div>
                <div>
                  <p className="text-sm font-black text-white">Connect Phantom Wallet</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    Link a Solana wallet to your account. Required before the DSG token bridge launches.
                  </p>
                </div>
              </div>
              <PhantomConnectButton label="Connect" />
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12"
            >
              <GlobalCard className="flex items-center gap-3">
                <div className="bg-green-500/20 p-3 rounded-xl">
                  <ArrowDownLeft className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-white/60 text-sm">Total Earned</p>
                  <p className="text-white font-black text-xl">₵{userBalance.toLocaleString()}</p>
                </div>
              </GlobalCard>

              <GlobalCard className="flex items-center gap-3">
                <div className="bg-red-500/20 p-3 rounded-xl">
                  <ArrowUpRight className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-white/60 text-sm">Total Cashed Out</p>
                  <p className="text-white font-black text-xl">₵0</p>
                </div>
              </GlobalCard>

              <GlobalCard className="flex items-center gap-3">
                <div className="bg-cyan-500/20 p-3 rounded-xl">
                  <Clock className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-white/60 text-sm">Pending Payouts</p>
                  <p className="text-white font-black text-xl">₵0</p>
                </div>
              </GlobalCard>
            </motion.div>

            {/* Pending Payouts Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <PendingPayouts
                key={refreshTrigger}
                userId={userId}
                onCancel={handleCancelPayout}
              />
            </motion.div>
          </>
        )}
      </div>

      {/* Payout Request Modal */}
      <PayoutRequestModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        userBalance={userBalance}
        onSubmit={handlePayoutRequest}
      />
      <TopUpVibezCoinsModal
        open={showTopUpModal}
        onClose={() => setShowTopUpModal(false)}
      />
    </div>
  );
};

export default Wallet;
