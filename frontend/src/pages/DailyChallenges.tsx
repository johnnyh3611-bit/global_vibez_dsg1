import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, Clock, Trophy, Flame } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function DailyChallenges() {
  const [challenges, setChallenges] = useState([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const response = await fetch(`${API_URL}/api/progression/daily-challenges/${userData.user_id}`);
      const data = await response.json();
      setChallenges(data.challenges || []);
      setStreak(data.streak || 0);
    } catch (error) {
      // console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async (challengeId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/progression/claim-daily-reward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ challenge_id: challengeId })
      });
      const data = await response.json();
      if (data.success) {
        alert(`✅ Claimed ${data.reward} coins!`);
        fetchChallenges();
      }
    } catch (error) {
      alert('Failed to claim reward');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" variant="default" />
      
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
            📅 Daily Challenges
          </h1>
          <p className="text-gray-300 text-lg">Complete challenges and earn rewards</p>
        </div>

        <Card className="bg-gradient-to-r from-orange-600 to-red-600 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Daily Streak</p>
              <p className="text-4xl font-black text-white">{streak} Days</p>
            </div>
            <Flame className="w-16 h-16 text-orange-200" />
          </div>
        </Card>

        <div className="space-y-4">
          {challenges.map((challenge) => (
            <Card key={challenge.id} className="bg-gray-800/50 border-gray-600 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-xl font-bold text-white">{challenge.title}</h3>
                  </div>
                  <p className="text-gray-400 mb-4">{challenge.description}</p>
                  
                  <div className="flex items-center gap-6 mb-4">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      <span className="text-white font-semibold">{challenge.reward} coins</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-400" />
                      <span className="text-gray-400 text-sm">Resets in {challenge.time_remaining}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{challenge.current}/{challenge.target}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-3">
                      <div 
                        className="bg-cyan-500 h-3 rounded-full transition-all"
                        style={{ width: `${(challenge.current / challenge.target) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="ml-6">
                  {challenge.completed ? (
                    challenge.claimed ? (
                      <div className="bg-gray-700 text-gray-400 px-6 py-3 rounded-lg flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Claimed
                      </div>
                    ) : (
                      <Button 
                        onClick={() => claimReward(challenge.id)}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        Claim Reward
                      </Button>
                    )
                  ) : (
                    <div className="bg-gray-700 px-6 py-3 rounded-lg">
                      <p className="text-gray-400 text-sm">In Progress</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
