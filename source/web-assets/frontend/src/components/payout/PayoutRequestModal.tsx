
import React, { useState } from 'react';
import { X, DollarSign, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PayoutRequestModal = ({ isOpen, onClose, userBalance, onSubmit }) => {
  const [coinAmount, setCoinAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('paypal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const CONVERSION_RATE = 1000; // 1,000 coins = $1 USD (updated 2026-05-18)
  const MIN_PAYOUT_COINS = 20000; // Minimum $10 USD
  const PLATFORM_FEE_PERCENT = 5; // 5% fee

  const calculateUSD = (coins) => {
    const gross = coins / CONVERSION_RATE;
    const fee = gross * (PLATFORM_FEE_PERCENT / 100);
    const net = gross - fee;
    return { gross, fee, net };
  };

  const coinAmountNum = Number(coinAmount) || 0;
  const usdPreview = coinAmount ? calculateUSD(parseInt(coinAmount as any)) : { gross: 0, fee: 0, net: 0 };
  const isValid = coinAmountNum >= MIN_PAYOUT_COINS && coinAmountNum <= userBalance;

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        coin_amount: parseInt(coinAmount),
        payout_method: payoutMethod
      });
      setCoinAmount('');
      onClose();
    } catch (error) {
      console.error('Payout request failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaxClick = () => {
    setCoinAmount(userBalance.toString());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-gradient-to-br from-gray-900 to-black border border-cyan-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-black text-white">Cash Out</h2>
                <button
                  onClick={onClose}
                  className="text-white/60 hover:text-white transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Available Balance */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <p className="text-white/60 text-sm mb-1">Available Balance</p>
                <p className="text-3xl font-black text-cyan-400">₵{userBalance.toLocaleString()}</p>
                <p className="text-white/40 text-xs mt-1">≈ ${(userBalance / CONVERSION_RATE).toFixed(2)} USD</p>
              </div>

              {/* Coin Input */}
              <div className="mb-4">
                <label className="text-white/80 text-sm font-semibold mb-2 block">Amount to Cash Out (Coins)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 font-black text-lg">₵</span>
                  <input
                    type="number"
                    value={coinAmount}
                    onChange={(e) => setCoinAmount(e.target.value)}
                    placeholder="20,000 minimum"
                    className="w-full bg-white/5 border border-white/20 rounded-xl pl-10 pr-20 py-3 text-white text-lg font-semibold focus:outline-none focus:border-cyan-400 transition"
                  />
                  <button
                    onClick={handleMaxClick}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs px-3 py-1 rounded-lg transition"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* USD Preview */}
              {coinAmount && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-4 mb-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-5 h-5 text-cyan-400" />
                    <p className="text-white font-semibold">USD Breakdown</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Gross Amount</span>
                      <span className="text-white font-semibold">${usdPreview.gross.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Platform Fee ({PLATFORM_FEE_PERCENT}%)</span>
                      <span className="text-red-400 font-semibold">-${usdPreview.fee.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-white/10 pt-2 flex justify-between">
                      <span className="text-white font-bold">You Receive</span>
                      <span className="text-cyan-400 font-black text-lg">${usdPreview.net.toFixed(2)}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Payout Method */}
              <div className="mb-6">
                <label className="text-white/80 text-sm font-semibold mb-2 block">Payout Method</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:border-cyan-400 transition"
                >
                  <option value="paypal">PayPal</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="crypto">Crypto (USDT)</option>
                </select>
              </div>

              {/* Validation Warning */}
              {coinAmount && !isValid && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-start gap-2"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="text-red-400 font-semibold">Invalid Amount</p>
                    {coinAmountNum < MIN_PAYOUT_COINS && (
                      <p className="text-red-300 text-xs mt-1">Minimum cashout: ₵20,000 ($10.00)</p>
                    )}
                    {coinAmountNum > userBalance && (
                      <p className="text-red-300 text-xs mt-1">Amount exceeds your balance</p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 72-Hour Notice */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-6">
                <p className="text-amber-400 text-xs font-semibold">⏳ Security Hold: 72 hours</p>
                <p className="text-amber-300/80 text-xs mt-1">Your payout will be processed after a 72-hour verification period. You can cancel anytime during this period.</p>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                disabled={!isValid || isSubmitting}
                className={`w-full py-4 rounded-xl font-black text-lg transition ${
                  isValid && !isSubmitting
                    ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-400 hover:to-purple-400 shadow-lg'
                    : 'bg-white/10 text-white/40 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'Processing...' : `Request Cashout - $${usdPreview.net.toFixed(2)}`}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PayoutRequestModal;