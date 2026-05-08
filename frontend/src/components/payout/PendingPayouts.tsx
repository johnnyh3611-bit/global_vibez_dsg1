
import React, { useState, useEffect } from 'react';
import { Clock, DollarSign, X, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const PendingPayouts = ({ userId, onCancel }) => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchPayouts();
    const interval = setInterval(fetchPayouts, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [userId]);

  const fetchPayouts = async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/payout/my-payouts/${userId}`);
      const data = await response.json();
      setPayouts(data.payouts || []);
    } catch (error) {
      console.error('Failed to fetch payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPayout = async (payoutId) => {
    if (!window.confirm('Are you sure you want to cancel this payout? Coins will be refunded to your account.')) {
      return;
    }

    setCancellingId(payoutId);
    try {
      const response = await fetch(`${API_URL}/api/v1/payout/cancel/${payoutId}?user_id=${userId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await fetchPayouts();
        if (onCancel) onCancel();
      } else {
        const error = await response.json();
        alert(error.detail || 'Failed to cancel payout');
      }
    } catch (error) {
      console.error('Failed to cancel payout:', error);
      alert('Failed to cancel payout');
    } finally {
      setCancellingId(null);
    }
  };

  const calculateTimeRemaining = (releaseDate: string) => {
    const now = new Date();
    const release = new Date(releaseDate);
    const diff = release.getTime() - now.getTime();
    
    if (diff <= 0) return { hours: 0, minutes: 0, expired: true };
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { hours, minutes, expired: false };
  };

  const getStatusBadge = (status) => {
    const badges = {
      security_hold: { text: 'Pending', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
      approved: { text: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      processing: { text: 'Processing', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      completed: { text: 'Completed', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
      cancelled: { text: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
      failed: { text: 'Failed', color: 'bg-red-500/20 text-red-400 border-red-500/30' }
    };
    
    const badge = badges[status] || badges.security_hold;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto"></div>
        <p className="text-white/60 mt-4">Loading payouts...</p>
      </div>
    );
  }

  if (payouts.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <DollarSign className="w-16 h-16 text-white/20 mx-auto mb-4" />
        <p className="text-white/60">No payout requests yet</p>
        <p className="text-white/40 text-sm mt-2">Your cashout history will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-black text-white mb-4">Payout History</h3>
      
      {payouts.map((payout, index) => {
        const timeRemaining = calculateTimeRemaining(payout.release_date);
        const canCancel = payout.status === 'security_hold' && !timeRemaining.expired;
        
        return (
          <motion.div
            key={payout.payout_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 hover:border-cyan-500/30 transition"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/60 text-xs font-semibold">Payout ID</p>
                <p className="text-white font-mono text-sm">{payout.payout_id}</p>
              </div>
              {getStatusBadge(payout.status)}
            </div>

            {/* Amount Details */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-white/60 text-xs mb-1">Coins Debited</p>
                <p className="text-white font-black text-lg">₵{payout.coins_debited.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-white/60 text-xs mb-1">Net Payout</p>
                <p className="text-cyan-400 font-black text-lg">${payout.net_usd.toFixed(2)}</p>
              </div>
            </div>

            {/* Countdown Timer (if pending) */}
            {canCancel && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <p className="text-amber-400 text-sm font-bold">Security Hold Period</p>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-amber-200 font-black text-2xl">{timeRemaining.hours}h {timeRemaining.minutes}m</p>
                    <p className="text-amber-300/60 text-xs">Time Remaining</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
                        style={{ width: `${Math.max(0, Math.min(100, 100 - (timeRemaining.hours / 72 * 100)))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Completed Status */}
            {payout.status === 'completed' && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <p className="text-green-400 text-sm font-semibold">Payout completed successfully</p>
              </div>
            )}

            {/* Cancelled Status */}
            {payout.status === 'cancelled' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-red-400 text-sm font-semibold">Payout cancelled - coins refunded</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="text-xs text-white/40">
                <p>Requested: {new Date(payout.request_date).toLocaleDateString()}</p>
                <p className="capitalize">Method: {payout.payout_method}</p>
              </div>
              
              {canCancel && (
                <button
                  onClick={() => handleCancelPayout(payout.payout_id)}
                  disabled={cancellingId === payout.payout_id}
                  className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg font-semibold text-sm transition disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  {cancellingId === payout.payout_id ? 'Cancelling...' : 'Cancel Payout'}
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default PendingPayouts;