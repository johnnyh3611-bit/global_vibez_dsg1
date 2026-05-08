
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, AlertCircle, Coins } from 'lucide-react';
import { GlassCard } from '../GlassCard';
import { useToast } from '@/hooks/useToast';

const API = process.env.REACT_APP_BACKEND_URL;
const COINS_PER_DOLLAR = 2000;
const MIN_BET = 10;
const MAX_BET = 100;

export function PlaceBetModal({ isOpen, onClose, gameId, gameType, outcomes, onBetPlaced }) {
  const [pool, setPool] = useState(null);
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [betAmount, setBetAmount] = useState(50);
  const [userBalance, setUserBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const { success, error: showError } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchPoolAndBalance();
      // Refresh odds every 3 seconds
      const interval = setInterval(fetchPool, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, gameId]);

  const fetchPoolAndBalance = async () => {
    await Promise.all([fetchPool(), fetchBalance()]);
  };

  const fetchPool = async () => {
    try {
      const response = await fetch(`${API}/api/watch-and-wager/pool/${gameId}`, {
      });
      if (!response.ok) throw new Error('Failed to fetch pool');
      const data = await response.json();
      setPool(data.pool);
    } catch (error) {
      // console.error('Error fetching pool:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${API}/api/coins/balance`, {
      });
      if (!response.ok) throw new Error('Failed to fetch balance');
      const data = await response.json();
      setUserBalance(data.coins);
    } catch (error) {
      // console.error('Error fetching balance:', error);
    }
  };

  const handlePlaceBet = async () => {
    if (!selectedOutcome) {
      showError('Please select an outcome');
      return;
    }

    if (betAmount < MIN_BET || betAmount > MAX_BET) {
      showError(`Bet must be between ${MIN_BET} and ${MAX_BET} coins`);
      return;
    }

    if (betAmount > userBalance) {
      showError('Insufficient coins');
      return;
    }

    setPlacing(true);
    try {
      const response = await fetch(`${API}/api/watch-and-wager/place-bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          game_id: gameId,
          game_type: gameType,
          prediction: selectedOutcome,
          amount: betAmount
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to place bet');
      }

      const data = await response.json();
      success(data.message, 'Bet Placed!');
      
      if (onBetPlaced) {
        onBetPlaced(data);
      }
      
      onClose();
    } catch (error) {
      // console.error('Error placing bet:', error);
      showError(error.message || 'Failed to place bet');
    } finally {
      setPlacing(false);
    }
  };

  const getPotentialPayout = () => {
    if (!pool || !selectedOutcome) return 0;
    const odds = pool.current_odds?.[selectedOutcome] || 2.0;
    return Math.floor(betAmount * odds);
  };

  const getPotentialProfit = () => {
    return getPotentialPayout() - betAmount;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-2xl w-full"
        >
          <GlassCard variant="gaming" className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-white mb-1">Place Your Bet</h2>
                <p className="text-white/70 text-sm">Choose outcome and bet amount</p>
              </div>
              <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                <X size={28} />
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4 animate-pulse">🎰</div>
                <p className="text-white/60">Loading odds...</p>
              </div>
            ) : !pool ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <p className="text-white">Betting pool not found</p>
              </div>
            ) : (
              <>
                {/* Your Balance */}
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-400/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-400" />
                      <span className="text-white/70 text-sm">Your Balance</span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-lg">
                        {userBalance.toLocaleString()} coins
                      </div>
                      <div className="text-yellow-400 text-xs">
                        ${(userBalance / COINS_PER_DOLLAR).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pool Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="backdrop-blur-xl bg-white/5 rounded-xl p-3">
                    <div className="text-white/60 text-xs mb-1">Total Pool</div>
                    <div className="text-white font-bold">{pool.total_pool.toLocaleString()}</div>
                    <div className="text-yellow-400 text-xs">${(pool.total_pool / COINS_PER_DOLLAR).toFixed(2)}</div>
                  </div>
                  <div className="backdrop-blur-xl bg-white/5 rounded-xl p-3">
                    <div className="text-white/60 text-xs mb-1">Prize Pool</div>
                    <div className="text-white font-bold">{pool.prize_pool.toLocaleString()}</div>
                    <div className="text-green-400 text-xs">95% of pool</div>
                  </div>
                  <div className="backdrop-blur-xl bg-white/5 rounded-xl p-3">
                    <div className="text-white/60 text-xs mb-1">Total Bets</div>
                    <div className="text-white font-bold">{pool.bet_count}</div>
                  </div>
                </div>

                {/* Select Outcome */}
                <div className="mb-6">
                  <label className="text-white font-bold mb-3 block">Select Outcome</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(pool.current_odds || {}) as Array<[string, number]>).map(([outcome, odds]) => {
                      const betAmount = pool.predictions?.[outcome] || 0;
                      const percentage = pool.total_pool > 0 ? (betAmount / pool.total_pool * 100) : 0;
                      
                      return (
                        <motion.button
                          key={outcome}
                          onClick={() => setSelectedOutcome(outcome)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`
                            backdrop-blur-xl rounded-xl p-4 text-left transition-all border-2
                            ${selectedOutcome === outcome
                              ? 'bg-gradient-to-br from-fuchsia-600/40 to-pink-600/40 border-fuchsia-400 shadow-[0_0_20px_rgba(232,121,249,0.6)]'
                              : 'bg-white/5 border-white/20 hover:border-white/40'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white font-bold truncate">{outcome}</span>
                            <div className="px-2 py-1 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg">
                              <span className="text-white font-bold text-sm">{odds.toFixed(2)}x</span>
                            </div>
                          </div>
                          
                          {/* Pool distribution bar */}
                          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mb-2">
                            <div
                              className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">{betAmount.toLocaleString()} coins</span>
                            <span className="text-fuchsia-300 font-bold">{percentage.toFixed(0)}%</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Bet Amount */}
                <div className="mb-6">
                  <label className="text-white font-bold mb-3 block">Bet Amount</label>
                  <div className="flex gap-3 mb-3">
                    <input
                      type="number"
                      value={betAmount}
                      onChange={(e) => setBetAmount(Math.max(MIN_BET, Math.min(MAX_BET, parseInt(e.target.value) || MIN_BET)))}
                      min={MIN_BET}
                      max={MAX_BET}
                      className="flex-1 bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-center text-xl font-bold focus:border-fuchsia-400 focus:outline-none"
                    />
                    <div className="flex flex-col gap-2">
                      {[MIN_BET, 50, MAX_BET].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setBetAmount(amount)}
                          className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                            betAmount === amount
                              ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white'
                              : 'bg-white/10 text-white/60 hover:bg-white/20'
                          }`}
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="text-white/60 text-sm">
                    Min: {MIN_BET} • Max: {MAX_BET} coins
                  </div>
                </div>

                {/* Potential Payout */}
                {selectedOutcome && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-400/40"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      <span className="text-white font-bold">Potential Payout</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-white">
                        {getPotentialPayout().toLocaleString()}
                      </span>
                      <span className="text-green-400 text-lg">coins</span>
                    </div>
                    <div className="text-green-400 text-sm mt-1">
                      Profit: +{getPotentialProfit().toLocaleString()} coins (${(getPotentialProfit() / COINS_PER_DOLLAR).toFixed(2)})
                    </div>
                  </motion.div>
                )}

                {/* Place Bet Button */}
                <button
                  onClick={handlePlaceBet}
                  disabled={!selectedOutcome || placing || betAmount > userBalance}
                  className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-bold text-lg rounded-xl hover:from-fuchsia-500 hover:to-pink-500 transition-all shadow-[0_0_30px_rgba(232,121,249,0.6)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {placing ? (
                    <div className="flex items-center justify-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Placing Bet...
                    </div>
                  ) : (
                    `Place Bet - ${betAmount} coins`
                  )}
                </button>
              </>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
