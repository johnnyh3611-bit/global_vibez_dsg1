import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wallet as WalletIcon, DollarSign, TrendingUp, ArrowUpRight, ArrowDownLeft, Clock, Sparkles } from 'lucide-react';
import UnifiedNavigation from '../components/hub/UnifiedNavigation';
import PayoutRequestModal from '../components/payout/PayoutRequestModal';
import PendingPayouts from '../components/payout/PendingPayouts';

const Wallet = () => {
  const navigate = useNavigate();
  const [userBalance, setUserBalance] = useState(100000); // Demo balance
  const [userId, setUserId] = useState('demo_user_123'); // Demo user ID
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // TODO: Fetch real user data from auth context
  useEffect(() => {
    // Placeholder for fetching user balance from API
    // const fetchUserData = async () => {
    //   const response = await fetch(`${API_URL}/api/v1/user/profile`);
    //   const data = await response.json();
    //   setUserBalance(data.credits_balance);
    //   setUserId(data.id);
    // };
    // fetchUserData();
  }, []);

  const handlePayoutRequest = async (payoutData) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/payout/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ...payoutData
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}\n\nPayout ID: ${result.payout_id}\nAmount: $${result.net_payout.toFixed(2)}\nRelease Date: ${new Date(result.release_date).toLocaleString()}`);
        
        // Update balance
        setUserBalance(prev => prev - payoutData.coin_amount);
        setRefreshTrigger(prev => prev + 1);
      } else {
        const error = await response.json();
        alert(`❌ Payout failed: ${error.detail}`);
      }
    } catch (error) {
      console.error('Payout request failed:', error);
      alert('Failed to process payout request');
    }
  };

  const handleCancelPayout = () => {
    // Refresh balance after cancellation
    setRefreshTrigger(prev => prev + 1);
  };

  const usdEquivalent = (userBalance / 2000).toFixed(2);

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
            <p className="text-white/60 text-sm mt-2">1 USD = ₵2,000 Vibez Coins</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => navigate('/games')}
              className="bg-white/20 hover:bg-white/30 backdrop-blur text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2"
            >
              <TrendingUp className="w-5 h-5" />
              Earn More
            </button>
            <button
              onClick={() => setShowPayoutModal(true)}
              disabled={userBalance < 20000}
              className={`font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2 ${
                userBalance >= 20000
                  ? 'bg-white text-purple-600 hover:bg-white/90'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              <DollarSign className="w-5 h-5" />
              Cash Out
            </button>
          </div>

          {userBalance < 20000 && (
            <p className="text-white/60 text-xs text-center mt-3">
              Minimum cashout: ₵20,000 ($10.00)
            </p>
          )}
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12"
        >
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-green-500/20 p-3 rounded-xl">
                <ArrowDownLeft className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Total Earned</p>
                <p className="text-white font-black text-xl">₵250,000</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-red-500/20 p-3 rounded-xl">
                <ArrowUpRight className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Total Cashed Out</p>
                <p className="text-white font-black text-xl">₵150,000</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-cyan-500/20 p-3 rounded-xl">
                <Clock className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Pending Payouts</p>
                <p className="text-white font-black text-xl">₵0</p>
              </div>
            </div>
          </div>
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
      </div>

      {/* Payout Request Modal */}
      <PayoutRequestModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
        userBalance={userBalance}
        onSubmit={handlePayoutRequest}
      />
    </div>
  );
};

export default Wallet;
