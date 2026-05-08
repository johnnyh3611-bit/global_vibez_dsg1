import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Gift, Sparkles, X, Coins } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Google AdSense Rewarded Video Ad Component
 * Users watch ads to earn credits, boosts, or unlock features
 */
export default function RewardedVideoAd({ onComplete, onClose, rewardType = 'credits' }) {
  const [adState, setAdState] = useState('ready'); // 'ready', 'loading', 'playing', 'complete'
  const [reward, setReward] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [error, setError] = useState(null);

  // Mock ad ID (in production, this would come from AdSense)
  const adId = `ad_${Date.now()}`;

  const REWARD_CONFIG = {
    credits: {
      title: 'Watch & Earn',
      description: 'Watch a 30-second video to earn 100 Vibe Credits!',
      icon: Coins,
      color: 'from-yellow-500 to-orange-500',
      emoji: '💰'
    },
    boost: {
      title: 'Dating Boost',
      description: 'Watch to get a 24-hour dating profile boost!',
      icon: Sparkles,
      color: 'from-pink-500 to-purple-500',
      emoji: '✨'
    },
    continue: {
      title: 'Game Continue',
      description: 'Watch to continue your game!',
      icon: Play,
      color: 'from-green-500 to-emerald-500',
      emoji: '🎮'
    },
    unlock: {
      title: 'Unlock Feature',
      description: 'Watch to unlock this feature for 24 hours!',
      icon: Gift,
      color: 'from-blue-500 to-cyan-500',
      emoji: '🔓'
    }
  };

  const config = REWARD_CONFIG[rewardType] || REWARD_CONFIG.credits;

  // Countdown timer during ad playback
  useEffect(() => {
    if (adState === 'playing' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (adState === 'playing' && countdown === 0) {
      handleAdComplete();
    }
  }, [adState, countdown]);

  const handleStartAd = () => {
    setAdState('loading');
    
    // Simulate ad loading
    setTimeout(() => {
      setAdState('playing');
      setCountdown(30); // 30-second ad
    }, 2000);
  };

  const handleAdComplete = async () => {
    setAdState('complete');

    try {
      // Claim reward from backend
      const response = await fetch(`${API_URL}/api/monetization/ads/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          ad_id: adId,
          ad_type: 'video',
          reward_type: rewardType
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setReward(data.reward);
        if (onComplete) {
          onComplete(data);
        }
      } else {
        setError('Failed to claim reward');
      }
    } catch (err) {
      // console.error('Failed to claim ad reward:', err);
      setError('Failed to claim reward');
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && adState === 'ready' && handleClose()}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-gradient-to-br from-gray-900 to-purple-900 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border-2 border-purple-500/30"
        >
          {/* Ready State */}
          {adState === 'ready' && (
            <div className="p-8 text-center">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X size={24} className="text-white" />
              </button>

              <div className="text-6xl mb-4">{config.emoji}</div>
              <h2 className="text-3xl font-bold text-white mb-2">{config.title}</h2>
              <p className="text-purple-200 text-lg mb-8">{config.description}</p>

              <div className="bg-white/10 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-center gap-4">
                  <Play className="text-yellow-400" size={32} />
                  <div className="text-left">
                    <div className="text-white font-semibold">30-second video</div>
                    <div className="text-purple-300 text-sm">No skipping allowed</div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartAd}
                className={`w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r ${config.color} hover:opacity-90 transition-opacity text-white shadow-lg`}
              >
                Watch Ad & Claim Reward
              </button>
            </div>
          )}

          {/* Loading State */}
          {adState === 'loading' && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white text-xl">Loading ad...</p>
            </div>
          )}

          {/* Playing State */}
          {adState === 'playing' && (
            <div className="relative">
              {/* Mock Ad Video Player */}
              <div className="bg-black aspect-video flex items-center justify-center relative">
                <div className="text-center">
                  <div className="text-white text-6xl mb-4">📺</div>
                  <div className="text-white text-2xl font-bold mb-2">Ad Playing...</div>
                  <div className="text-purple-300">This is a simulated ad</div>
                </div>

                {/* Countdown Timer */}
                <div className="absolute top-4 right-4 bg-black/80 px-4 py-2 rounded-full">
                  <div className="text-white font-bold text-lg">{countdown}s</div>
                </div>

                {/* Can't Skip Message */}
                <div className="absolute bottom-4 left-4 right-4 bg-black/80 px-4 py-2 rounded-lg">
                  <div className="text-white text-sm text-center">
                    Watch the full ad to claim your reward
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-gray-800 h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${((30 - countdown) / 30) * 100}%` }}
                  className={`h-full bg-gradient-to-r ${config.color}`}
                />
              </div>
            </div>
          )}

          {/* Complete State */}
          {adState === 'complete' && (
            <div className="p-8 text-center">
              {error ? (
                <>
                  <div className="text-6xl mb-4">❌</div>
                  <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
                  <p className="text-red-300 mb-8">{error}</p>
                  <button
                    onClick={handleClose}
                    className="px-6 py-3 rounded-xl bg-gray-600 hover:bg-gray-700 text-white font-semibold"
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="text-6xl mb-4"
                  >
                    🎉
                  </motion.div>
                  <h2 className="text-3xl font-bold text-white mb-2">Reward Claimed!</h2>
                  <p className="text-purple-200 text-lg mb-8">{reward}</p>

                  <div className={`bg-gradient-to-r ${config.color} p-6 rounded-xl mb-8`}>
                    <div className="text-white text-2xl font-bold">{config.emoji} Success!</div>
                  </div>

                  <button
                    onClick={handleClose}
                    className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg"
                  >
                    Continue
                  </button>
                </>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Ad Availability Indicator
 * Shows when next ad is available
 */
export function AdAvailabilityBadge({ rewardType = 'credits' }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [nextAvailable, setNextAvailable] = useState(null);

  useEffect(() => {
    checkAdAvailability();
    const interval = setInterval(checkAdAvailability, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [rewardType]);

  const checkAdAvailability = async () => {
    try {
      const response = await fetch(`${API_URL}/api/monetization/ads/available`, {
      });
      const data = await response.json();

      const ad = data.ads?.find(a => a.reward_type === `video_${rewardType}`);
      if (ad) {
        setIsAvailable(ad.available);
        setNextAvailable(ad.next_available);
      }
    } catch (error) {
      // console.error('Failed to check ad availability:', error);
    }
  };

  if (!isAvailable && !nextAvailable) return null;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
      isAvailable 
        ? 'bg-green-500/20 text-green-300 border border-green-500/50'
        : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
    }`}>
      <Play size={14} />
      {isAvailable ? 'Ad Ready!' : 'Cooldown...'}
    </div>
  );
}
