import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Trophy, Zap, Flame, X } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DailyRewardsModal() {
  const [showModal, setShowModal] = useState(false);
  const [rewardData, setRewardData] = useState(null);
  const [stats, setStats] = useState(null);
  const [claiming, setClaiming] = useState(false);

  const userId = localStorage.getItem('user_id');

  useEffect(() => {
    // Check if user should see daily reward on mount
    checkDailyReward();
  }, []);

  const checkDailyReward = async () => {
    try {
      // Fetch user stats to get streak info
      const statsResponse = await fetch(`${API}/api/engagement/profile/stats/${userId}`);
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        setStats(statsData.stats);
        
        // Check if reward is available (simplified - you may want to check last_daily_claim)
        const lastClaim = localStorage.getItem(`last_daily_claim_${userId}`);
        const today = new Date().toDateString();
        
        if (lastClaim !== today) {
          // Show the modal after a short delay for better UX
          setTimeout(() => setShowModal(true), 1000);
        }
      }
    } catch (error) {
      // console.error('Error checking daily reward:', error);
    }
  };

  const claimReward = async () => {
    setClaiming(true);
    try {
      const response = await fetch(`${API}/api/engagement/daily-reward/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRewardData(data);
        localStorage.setItem(`last_daily_claim_${userId}`, new Date().toDateString());
        
        // Close modal after 3 seconds
        setTimeout(() => {
          setShowModal(false);
          window.location.reload(); // Refresh to update XP/level
        }, 3000);
      } else {
        alert(data.message || 'Already claimed today!');
        setShowModal(false);
      }
    } catch (error) {
      // console.error('Error claiming reward:', error);
      alert('Error claiming reward. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  if (!stats) return null;

  const currentStreak = rewardData?.current_streak || stats.login_streak || 0;
  const baseXp = rewardData?.base_xp || 50;
  const streakBonus = rewardData?.streak_bonus || Math.min(currentStreak * 10, 200);
  const totalXp = rewardData?.xp_earned || baseXp + streakBonus;

  return (
    <AnimatePresence>
      {showModal && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !rewardData && setShowModal(false)}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative max-w-lg w-full bg-gradient-to-br from-purple-900/90 via-black/90 to-cyan-900/90 backdrop-blur-xl rounded-3xl border-2 border-cyan-500/50 shadow-2xl overflow-hidden"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ type: 'spring', duration: 0.5 }}
            >
              {/* Confetti Particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(40)].map((_, i) => (
                  <motion.div
                    key={_.id || _.name || `item-${i}`}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: ['#06b6d4', '#a855f7', '#fbbf24', '#f43f5e'][i % 4],
                      left: `${Math.random() * 100}%`,
                      top: '-10%',
                    }}
                    animate={{
                      y: [0, 600],
                      rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)],
                      opacity: [1, 0],
                    }}
                    transition={{
                      duration: 2 + Math.random() * 2,
                      delay: Math.random() * 0.5,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </div>

              {/* Glow Effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-purple-500/20"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              />

              {/* Close Button */}
              {!rewardData && (
                <button
                  onClick={() => setShowModal(false)}
                  className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              )}

              {/* Content */}
              <div className="relative z-10 p-8 text-center">
                {/* Icon */}
                <motion.div
                  className="mx-auto w-24 h-24 mb-6 relative"
                  animate={{
                    rotate: rewardData ? [0, 360] : [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{ duration: rewardData ? 0.5 : 1, repeat: rewardData ? 0 : Infinity }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-xl opacity-60" />
                  <div className="relative w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    {rewardData ? (
                      <Trophy className="w-12 h-12 text-white" />
                    ) : (
                      <Gift className="w-12 h-12 text-white" />
                    )}
                  </div>
                </motion.div>

                {/* Title */}
                <motion.h2
                  className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  {rewardData ? 'Reward Claimed! 🎉' : 'Daily Reward! 🎁'}
                </motion.h2>

                <motion.p
                  className="text-cyan-300 text-lg mb-6"
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {rewardData ? "You're on fire!" : 'Welcome back, champion!'}
                </motion.p>

                {/* Streak Display */}
                <motion.div
                  className="mb-6 p-6 bg-black/40 rounded-2xl border border-orange-500/50"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Flame className="w-8 h-8 text-orange-400" />
                    <span className="text-3xl font-bold text-white">{currentStreak}</span>
                    <span className="text-xl text-gray-400">Day Streak!</span>
                  </div>

                  {/* Reward Breakdown */}
                  <div className="space-y-2 text-left">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Base Reward:</span>
                      <span className="text-cyan-400 font-bold">+{baseXp} XP</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-300">Streak Bonus:</span>
                      <span className="text-purple-400 font-bold">+{streakBonus} XP</span>
                    </div>
                    <div className="h-px bg-cyan-500/30 my-2" />
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Total:</span>
                      <motion.span
                        className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
                      >
                        +{totalXp} XP
                      </motion.span>
                    </div>
                  </div>
                </motion.div>

                {/* Progress Bar */}
                <motion.div
                  className="mb-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Level {stats.level}</span>
                    <span>Level {stats.level + 1}</span>
                  </div>
                  <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full relative"
                      initial={{ width: `${Math.max(0, stats.progress_to_next_level - 5)}%` }}
                      animate={{ width: `${stats.progress_to_next_level}%` }}
                      transition={{ duration: 1, delay: 0.6 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={{ x: [-100, 300] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </motion.div>
                  </div>
                </motion.div>

                {/* Claim Button */}
                {!rewardData && (
                  <motion.button
                    className="w-full py-4 px-8 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl font-bold text-white text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ scale: claiming ? 1 : 1.05 }}
                    whileTap={{ scale: claiming ? 1 : 0.95 }}
                    onClick={claimReward}
                    disabled={claiming}
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(6, 182, 212, 0.5)',
                        '0 0 40px rgba(168, 85, 247, 0.8)',
                        '0 0 20px rgba(6, 182, 212, 0.5)',
                      ],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <Trophy className="w-6 h-6" />
                      {claiming ? 'Claiming...' : 'Claim Reward'}
                      <Zap className="w-6 h-6" />
                    </span>
                  </motion.button>
                )}

                <motion.p
                  className="mt-4 text-xs text-gray-400"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  {rewardData
                    ? 'Redirecting...'
                    : 'Come back tomorrow to keep your streak going! 🔥'}
                </motion.p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
