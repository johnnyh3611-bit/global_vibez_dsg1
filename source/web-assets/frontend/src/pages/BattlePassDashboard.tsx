import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Lock, Zap, Star, Crown, Gift, ChevronRight, CheckCircle } from 'lucide-react';
import BackButton from '@/components/BackButton';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BattlePassDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [season, setSeason] = useState(null);
  const [rewards, setRewards] = useState({ free: [], premium: [] });
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    fetchBattlePassData();
  }, []);

  const fetchBattlePassData = async () => {
    try {
      const [seasonRes, progressRes, rewardsRes] = await Promise.all([
        fetch(`${API_URL}/api/battle-pass/current-season`),
        fetch(`${API_URL}/api/battle-pass/my-progress`, { }),
        fetch(`${API_URL}/api/battle-pass/rewards`)
      ]);

      const seasonData = await seasonRes.json();
      const progressData = await progressRes.json();
      const rewardsData = await rewardsRes.json();

      setSeason(seasonData);
      setProgress(progressData);
      setRewards(rewardsData);
    } catch (error) {
      // console.error('Error fetching Battle Pass data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchasePremium = async () => {
    setPurchasing(true);

    try {
      const response = await fetch(`${API_URL}/api/battle-pass/purchase`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error('Failed to create checkout');
      }
    } catch (error) {
      // console.error('Error purchasing Battle Pass:', error);
      alert('Failed to purchase. Please try again.');
      setPurchasing(false);
    }
  };

  const handleClaimReward = async (rewardId) => {
    try {
      const response = await fetch(`${API_URL}/api/battle-pass/claim-reward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({ reward_id: rewardId })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Claimed: ${data.reward.name}`);
        fetchBattlePassData();
      } else {
        throw new Error(data.message || 'Failed to claim');
      }
    } catch (error) {
      // console.error('Error claiming reward:', error);
      alert('Failed to claim reward. ' + error.message);
    }
  };

  const calculateProgress = () => {
    if (!progress) return 0;
    const xpForNextLevel = 100 + (progress.current_level * 50);
    return (progress.current_xp / xpForNextLevel) * 100;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading Battle Pass...</div>
      </div>
    );
  }

  const isPremium = progress?.has_premium || false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      {/* Back Button */}
      <BackButton to="/dashboard" label="Back to Hub" variant="default" />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent">
                  Battle Pass
                </h1>
              </div>
              <p className="text-gray-300">{season?.name} • Season {season?.season_id}</p>
            </div>

            {!isPremium && (
              <button
                onClick={handlePurchasePremium}
                disabled={purchasing}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold px-8 py-4 rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-yellow-500/50 flex items-center gap-2"
              >
                <Crown className="w-5 h-5" />
                {purchasing ? 'Processing...' : `Upgrade to Premium - $${season?.price_usd}`}
              </button>
            )}

            {isPremium && (
              <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg px-6 py-3">
                <div className="flex items-center gap-2 text-yellow-400 font-bold">
                  <Crown className="w-5 h-5" />
                  Premium Active
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="bg-cyan-500/20 border border-cyan-500 rounded-lg px-4 py-2">
                  <span className="text-cyan-400 text-2xl font-black">Level {progress?.current_level || 1}</span>
                </div>
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="text-gray-300">{progress?.current_xp || 0} / {progress?.xp_to_next_level || 150} XP</span>
              </div>
              <span className="text-gray-400 text-sm">Max Level: {season?.max_level}</span>
            </div>

            <div className="relative h-6 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 transition-all duration-500"
                style={{ width: `${calculateProgress()}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-xs font-bold">{Math.round(calculateProgress())}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Comparison */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Free Tier */}
          <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Gift className="w-5 h-5 text-gray-400" />
              <h3 className="text-xl font-bold text-white">Free Pass</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Rewards every 5 levels
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Basic coins & items
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Standard progression
              </li>
            </ul>
          </div>

          {/* Premium Tier */}
          <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 border border-yellow-500 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-yellow-400" />
              <h3 className="text-xl font-bold text-yellow-400">Premium Pass - ${season?.price_usd}</h3>
            </div>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Rewards EVERY level
              </li>
              <li className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Exclusive cosmetics & skins
              </li>
              <li className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                2x bonus coins
              </li>
              <li className="flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-400" />
                Instant unlock of 10+ items
              </li>
            </ul>
          </div>
        </div>

        {/* Rewards Track */}
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-600 rounded-2xl p-6">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-cyan-400" />
            Rewards Track
          </h3>

          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {progress?.available_rewards && progress.available_rewards.length > 0 ? (
              progress.available_rewards.map((reward, index) => {
                const isLocked = reward.tier === 'premium' && !isPremium;
                const isClaimed = progress.claimed_rewards?.includes(reward.reward_id);

                return (
                  <div
                    key={reward.reward_id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${
                      isLocked
                        ? 'bg-gray-900/50 border-gray-700'
                        : isClaimed
                        ? 'bg-green-900/20 border-green-500/30'
                        : 'bg-gradient-to-r from-cyan-900/20 to-purple-900/20 border-cyan-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        reward.tier === 'premium' ? 'bg-yellow-500/20 border border-yellow-500' : 'bg-gray-700'
                      }`}>
                        {reward.tier === 'premium' ? (
                          <Crown className="w-6 h-6 text-yellow-400" />
                        ) : (
                          <Gift className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-bold">{reward.name}</h4>
                          <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">
                            Level {reward.level}
                          </span>
                          {reward.tier === 'premium' && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
                              Premium
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm">{reward.description}</p>
                      </div>
                    </div>

                    <div>
                      {isClaimed ? (
                        <div className="flex items-center gap-2 text-green-400">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm font-semibold">Claimed</span>
                        </div>
                      ) : isLocked ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Lock className="w-5 h-5" />
                          <span className="text-sm">Premium Only</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleClaimReward(reward.reward_id)}
                          className="bg-cyan-500 hover:bg-cyan-400 text-white font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                        >
                          Claim
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No rewards available yet. Keep playing to earn XP!</p>
              </div>
            )}
          </div>
        </div>

        {/* How to Earn XP */}
        <div className="mt-8 bg-cyan-900/20 border border-cyan-500/30 rounded-xl p-6">
          <h3 className="text-xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5" />
            How to Earn XP
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-black/30 rounded-lg p-3">
              <span className="text-cyan-400 font-bold">+50 XP</span>
              <p className="text-gray-300">Win a game</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <span className="text-cyan-400 font-bold">+200 XP</span>
              <p className="text-gray-300">Win a tournament</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <span className="text-cyan-400 font-bold">+20 XP</span>
              <p className="text-gray-300">Daily login</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BattlePassDashboard;
