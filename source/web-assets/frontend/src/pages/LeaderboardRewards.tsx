import React, { useState, useEffect } from 'react';
import { Trophy, Award, Gift, Star } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function LeaderboardRewards() {
  const [rewards, setRewards] = useState([]);
  const [myRewards, setMyRewards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const [allRewardsRes, myRewardsRes] = await Promise.all([
        fetch(`${API_URL}/api/leaderboards/rewards`),
        fetch(`${API_URL}/api/leaderboards/my-rewards/${userData.user_id}`)
      ]);

      const allRewardsData = await allRewardsRes.json();
      const myRewardsData = await myRewardsRes.json();

      setRewards(allRewardsData.rewards || []);
      setMyRewards(myRewardsData.rewards || []);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (rewardId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/leaderboards/claim-reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reward_id: rewardId })
      });
      const data = await response.json();
      if (data.success) {
        alert('✅ Reward claimed!');
        fetchRewards();
      }
    } catch (error) {
      alert('Failed to claim reward');
    }
  };

  const getTierIcon = (tier) => {
    if (tier === 'legendary') return <Trophy className="w-8 h-8 text-yellow-400" />;
    if (tier === 'epic') return <Award className="w-8 h-8 text-purple-400" />;
    if (tier === 'rare') return <Star className="w-8 h-8 text-blue-400" />;
    return <Gift className="w-8 h-8 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-orange-900 to-black py-8 px-4">
      <BackButton to="/leaderboard" label="Back to Leaderboard" />
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent mb-4">
            🏆 Leaderboard Rewards
          </h1>
          <p className="text-gray-300 text-lg">Claim your prizes for ranking high</p>
        </div>

        {myRewards.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">My Unclaimed Rewards</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {myRewards.map((reward) => (
                <Card key={reward.reward_id} className="bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-500 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getTierIcon(reward.tier)}
                        <h3 className="text-xl font-bold text-white">{reward.name}</h3>
                      </div>
                      <p className="text-yellow-100 text-sm mb-3">{reward.description}</p>
                      <p className="text-yellow-200 font-semibold">Earned: {new Date(reward.earned_at).toLocaleDateString()}</p>
                    </div>
                    <Button 
                      onClick={() => claimReward(reward.reward_id)}
                      className="bg-white text-black hover:bg-gray-100 font-bold"
                    >
                      Claim
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-white mb-4">All Available Rewards</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {rewards.map((reward) => (
            <Card key={reward.reward_id} className="bg-gray-800/50 border-gray-600 p-6">
              <div className="text-center mb-4">{getTierIcon(reward.tier)}</div>
              <h3 className="text-xl font-bold text-white text-center mb-2">{reward.name}</h3>
              <p className="text-gray-400 text-sm text-center mb-4">{reward.description}</p>
              <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs">Requirement</p>
                <p className="text-white font-semibold">{reward.requirement}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
