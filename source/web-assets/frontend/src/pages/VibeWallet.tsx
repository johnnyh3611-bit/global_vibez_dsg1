import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Sparkles, TrendingUp, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SolanaDepositPanel from '@/components/wallet/SolanaDepositPanel';
import VibePhoneCard from '@/components/voice/VibePhoneCard';
import WalletMemoCard from '@/components/wallet/WalletMemoCard';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function VibeWallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  
  const [userId] = useState('test_user_wallet');
  const [balance, setBalance] = useState(0);
  const [packages, setPackages] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null);

  useEffect(() => {
    fetchBalance();
    fetchPackages();
    fetchTransactions();
    
    // Check payment status if returning from Stripe
    if (sessionId) {
      pollPaymentStatus(sessionId);
    }
  }, [sessionId]);

  const fetchBalance = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wallet/balance/${userId}`);
      const data = await res.json();
      if (data.success) {
        setBalance(data.balance);
      }
    } catch (err) {
      // console.error('Error fetching balance:', err);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wallet/packages`);
      const data = await res.json();
      // Handle both old and new wallet API response formats
      if (data.packages) {
        // Normalize package format for UI
        const normalizedPackages = data.packages.map(pkg => ({
          package_id: pkg.package_id,
          display: pkg.display || pkg.name || `$${pkg.usd_amount || pkg.amount}`,
          amount: pkg.amount || pkg.usd_amount || 0,
          bonus: pkg.bonus || pkg.bonus_credits || 0,
          total: pkg.total || pkg.credit_amount || (pkg.amount || pkg.usd_amount || 0) + (pkg.bonus || pkg.bonus_credits || 0),
          popular: pkg.popular || false
        }));
        setPackages(normalizedPackages);
      }
    } catch (err) {
      // console.error('Error fetching packages:', err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/wallet/transactions/${userId}?limit=10`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (err) {
      // console.error('Error fetching transactions:', err);
    }
  };

  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    if (attempts >= maxAttempts) {
      setPaymentStatus({ type: 'error', message: 'Payment check timed out. Please refresh.' });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/wallet/topup/status/${sessionId}`);
      const data = await res.json();

      if (data.payment_status === 'paid') {
        setPaymentStatus({ 
          type: 'success', 
          message: `Payment successful! $${data.credits_added} added to your wallet.` 
        });
        fetchBalance();
        fetchTransactions();
        return;
      } else if (data.status === 'expired') {
        setPaymentStatus({ type: 'error', message: 'Payment session expired.' });
        return;
      }

      // Continue polling
      setTimeout(() => pollPaymentStatus(sessionId, attempts + 1), 2000);
    } catch (err) {
      // console.error('Error checking payment:', err);
      setPaymentStatus({ type: 'error', message: 'Error checking payment status.' });
    }
  };

  const handleTopUp = async (packageId) => {
    setLoading(true);
    try {
      const originUrl = window.location.origin;
      const res = await fetch(`${API_URL}/api/wallet/topup/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: packageId,
          origin_url: originUrl
        })
      });

      const data = await res.json();
      if (data.success && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        alert('Error creating checkout session');
      }
    } catch (err) {
      // console.error('Error creating checkout:', err);
      alert('Error initiating payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/games')}
            className="text-purple-400 hover:text-purple-300 mb-4 flex items-center gap-2"
          >
            ← Back to Games
          </button>
          <h1 className="text-4xl font-black mb-2">VIBE WALLET</h1>
          <p className="text-gray-400">Manage your credits for Vibe 6-5-4 Dice</p>
        </div>

        {/* Payment Status Alert */}
        {paymentStatus && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-xl border-2 flex items-center gap-3 ${
              paymentStatus.type === 'success'
                ? 'bg-green-900/20 border-green-500'
                : 'bg-red-900/20 border-red-500'
            }`}
          >
            {paymentStatus.type === 'success' ? (
              <CheckCircle className="w-6 h-6 text-green-400" />
            ) : (
              <XCircle className="w-6 h-6 text-red-400" />
            )}
            <p className="flex-1">{paymentStatus.message}</p>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
          {/* Top-Up Packages */}
          <div>
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-3xl p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black">Current Balance</h2>
                  <p className="text-gray-400">Available credits</p>
                </div>
                <div className="text-right">
                  <p className="text-5xl font-black text-green-400">₵{Math.round(balance).toLocaleString()}</p>
                  <p className="text-sm text-gray-400">Vibez Coins</p>
                </div>
              </div>
            </div>

            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-cyan-400" /> Send SOL → ₵ Vibez
            </h2>
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start">
              <SolanaDepositPanel amountUsd={25} />
              <VibePhoneCard />
            </div>

            {/* Per-user persisted notepad — survives device hand-off */}
            <div className="mb-6">
              <WalletMemoCard />
            </div>

            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-purple-400" /> Top-Up Packages
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <motion.div
                  key={pkg.package_id}
                  whileHover={{ scale: 1.02 }}
                  className={`bg-gradient-to-br from-purple-900/40 to-pink-900/40 border-2 rounded-2xl p-6 relative overflow-hidden ${
                    pkg.popular ? 'border-yellow-400' : 'border-purple-500/30'
                  }`}
                >
                  {pkg.bonus > 0 && (
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1 rounded-full">
                      <Sparkles className="w-3 h-3 text-white inline mr-1" />
                      <span className="text-white text-xs font-black">+₵{pkg.bonus} Bonus</span>
                    </div>
                  )}
                  
                  <h3 className="text-xl font-black mb-2">{pkg.display}</h3>
                  <p className="text-3xl font-black text-green-400 mb-1">₵{pkg.total}</p>
                  <p className="text-sm text-gray-400 mb-4">Total Vibez Coins</p>
                  
                  <Button
                    onClick={() => handleTopUp(pkg.package_id)}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <DollarSign className="w-4 h-4 mr-2" /> Buy ${pkg.amount}
                      </>
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-black/60 border border-purple-500/30 rounded-2xl p-6">
            <h2 className="text-xl font-black mb-4">Transaction History</h2>
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {transactions.length === 0 ? (
                <p className="text-gray-500 text-sm">No transactions yet</p>
              ) : (
                transactions.map((tx) => (
                  <div
                    key={tx.transaction_id}
                    className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-3"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-sm">{tx.description}</p>
                      <span className={`text-sm font-black ${
                        tx.transaction_type === 'credit' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tx.transaction_type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                    <p className="text-xs text-purple-300 mt-1">
                      Balance: ${tx.balance_after.toFixed(2)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
