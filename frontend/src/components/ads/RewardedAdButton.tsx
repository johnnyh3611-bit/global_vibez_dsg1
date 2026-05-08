import React, { useState, useEffect } from 'react';
import { Play, Clock, Gift, TrendingUp, X } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RewardedAdButton = ({ onCreditsEarned }) => {
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdModal, setShowAdModal] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  const [impressionId, setImpressionId] = useState(null);
  const [adProgress, setAdProgress] = useState(0);

  useEffect(() => {
    checkAvailability();
    const interval = setInterval(checkAvailability, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const checkAvailability = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ads/available`, {
      });

      const data = await response.json();
      setAvailability(data);
    } catch (error) {
      // console.error('Error checking ad availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchAd = async () => {
    try {
      const response = await fetch(`${API_URL}/api/ads/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ ad_provider: 'google_admob' })
      });

      const data = await response.json();

      if (data.success) {
        setImpressionId(data.impression_id);
        setShowAdModal(true);
        setWatchingAd(true);
        simulateAdPlayback(data.impression_id);
      } else {
        throw new Error(data.message || 'Failed to start ad');
      }
    } catch (error) {
      alert('Failed to load ad: ' + error.message);
    }
  };

  const simulateAdPlayback = (impId) => {
    // In production, this would be replaced with actual Google AdMob SDK
    // For now, simulate a 30-second ad
    let progress = 0;
    const interval = setInterval(() => {
      progress += 1;
      setAdProgress(progress);

      if (progress >= 30) {
        clearInterval(interval);
        completeAd(impId);
      }
    }, 1000);
  };

  const completeAd = async (impId) => {
    try {
      const response = await fetch(`${API_URL}/api/ads/complete?impression_id=${impId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setWatchingAd(false);
        alert(`🎉 ${data.message}\n\nNew Balance: ${data.new_balance} Credits`);
        
        if (onCreditsEarned) {
          onCreditsEarned(data.credits_earned);
        }

        setShowAdModal(false);
        checkAvailability();
      } else {
        throw new Error(data.message || 'Failed to complete ad');
      }
    } catch (error) {
      alert('Error completing ad: ' + error.message);
      setWatchingAd(false);
      setShowAdModal(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg px-4 py-3">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!availability) return null;

  return (
    <>
      {/* Main Button */}
      <button
        onClick={handleWatchAd}
        disabled={!availability.can_watch || watchingAd}
        className={`relative overflow-hidden rounded-xl transition-all transform ${
          availability.can_watch
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 hover:scale-105'
            : 'bg-gray-700 cursor-not-allowed'
        }`}
      >
        <div className="px-6 py-4 flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            availability.can_watch ? 'bg-white/20' : 'bg-gray-600'
          }`}>
            {availability.can_watch ? (
              <Play className="w-6 h-6 text-white" />
            ) : (
              <Clock className="w-6 h-6 text-gray-400" />
            )}
          </div>

          <div className="text-left flex-1">
            <div className="text-white font-bold text-lg">
              {availability.can_watch ? 'Watch Ad' : 'Ad on Cooldown'}
            </div>
            <div className={`text-sm ${availability.can_watch ? 'text-green-100' : 'text-gray-400'}`}>
              {availability.can_watch ? (
                <span className="flex items-center gap-1">
                  <Gift className="w-4 h-4" />
                  Earn {availability.credits_per_ad} Vibe Credits
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  Next ad in {availability.next_available_in}
                </span>
              )}
            </div>
          </div>

          {availability.can_watch && (
            <TrendingUp className="w-5 h-5 text-white/70" />
          )}
        </div>

        {/* Shine effect */}
        {availability.can_watch && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        )}
      </button>

      {/* Ad Modal */}
      {showAdModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl border-2 border-cyan-500 max-w-2xl w-full p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Rewarded Ad</h3>
              {!watchingAd && (
                <button
                  onClick={() => setShowAdModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* Ad Player Simulation */}
            <div className="bg-black aspect-video rounded-lg flex items-center justify-center mb-6 relative">
              {watchingAd ? (
                <>
                  <div className="text-center">
                    <Play className="w-20 h-20 text-cyan-400 mx-auto mb-4 animate-pulse" />
                    <p className="text-white text-xl font-bold">Ad Playing...</p>
                    <p className="text-gray-400 mt-2">
                      {adProgress}s / {availability.ad_duration}s
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000"
                      style={{ width: `${(adProgress / availability.ad_duration) * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <Gift className="w-20 h-20 text-green-400 mx-auto mb-4" />
                  <p className="text-white text-xl font-bold">Ad Complete!</p>
                  <p className="text-gray-400 mt-2">Credits being awarded...</p>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-4">
              <p className="text-cyan-300 text-sm mb-2">
                <strong>💡 Note:</strong> In production, this will load a real 30-second video ad from Google AdMob.
              </p>
              <p className="text-gray-400 text-xs">
                You'll earn <strong>{availability.credits_per_ad} Vibe Credits</strong> after watching the full ad.
                Ads can be watched once every {availability.cooldown_hours} hour.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RewardedAdButton;
