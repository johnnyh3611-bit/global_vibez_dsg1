import React, { useState, useEffect } from 'react';
import { Trophy, Award, Medal, Star, Lock } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Card } from '@/components/ui/card';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function AchievementBadges() {
  const [achievements, setAchievements] = useState([]);
  const [userProgress, setUserProgress] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, []);

  const fetchAchievements = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const response = await fetch(`${API_URL}/api/progression/achievements/${userData.user_id}`);
      const data = await response.json();
      setAchievements(data.achievements || []);
      setUserProgress(data.progress || {});
    } catch (error) {
      // console.error('Error fetching achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (tier) => {
    if (tier === 'legendary') return <Trophy className="w-12 h-12 text-yellow-400" />;
    if (tier === 'epic') return <Award className="w-12 h-12 text-purple-400" />;
    if (tier === 'rare') return <Medal className="w-12 h-12 text-blue-400" />;
    return <Star className="w-12 h-12 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" variant="default" />
      
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-yellow-400 via-orange-400 to-red-500 bg-clip-text text-transparent mb-4">
            🏆 Achievements
          </h1>
          <p className="text-gray-300 text-lg">Unlock badges and earn rewards</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {achievements.map((achievement) => {
            const isUnlocked = userProgress[achievement.id]?.unlocked;
            const progress = userProgress[achievement.id]?.progress || 0;

            return (
              <Card 
                key={achievement.id} 
                className={`p-6 ${
                  isUnlocked 
                    ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500' 
                    : 'bg-gray-800/50 border-gray-600'
                }`}
              >
                <div className="text-center mb-4">
                  {isUnlocked ? getIcon(achievement.tier) : <Lock className="w-12 h-12 text-gray-600" />}
                </div>
                <h3 className="text-xl font-bold text-white text-center mb-2">{achievement.name}</h3>
                <p className="text-gray-400 text-sm text-center mb-4">{achievement.description}</p>
                
                {!isUnlocked && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-cyan-500 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {isUnlocked && (
                  <div className="mt-4 bg-green-500/20 border border-green-500 rounded-lg p-3 text-center">
                    <p className="text-green-400 font-bold text-sm">UNLOCKED!</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
