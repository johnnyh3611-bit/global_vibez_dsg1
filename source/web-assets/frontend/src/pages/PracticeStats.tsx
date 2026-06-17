
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, TrendingUp, Target, Gamepad2, ArrowLeft } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PracticeStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API}/api/practice/stats`, {
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
      setLoading(false);
    } catch (err) {
      // console.error('Error fetching stats:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <p className="text-white text-2xl">Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/practice')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Practice
          </Button>
          <div className="flex items-center gap-4">
            <Trophy className="w-12 h-12 text-yellow-400" />
            <div>
              <h1 className="text-4xl font-bold text-white">Practice Statistics</h1>
              <p className="text-purple-200">Your AI training progress</p>
            </div>
          </div>
        </div>

        {stats?.total_games === 0 ? (
          <Card className="p-12 bg-white/10 backdrop-blur-lg border-white/20 text-center">
            <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-white/40" />
            <h2 className="text-2xl font-bold text-white mb-3">No Practice Games Yet</h2>
            <p className="text-white/70 mb-6">Start playing against AI to track your progress!</p>
            <Button
              onClick={() => navigate('/practice')}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              Start Practice
            </Button>
          </Card>
        ) : (
          <>
            {/* Overall Stats */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
                <Gamepad2 className="w-8 h-8 text-blue-400 mb-2" />
                <p className="text-white/60 text-sm">Total Games</p>
                <p className="text-4xl font-bold text-white">{stats.total_games}</p>
              </Card>
              <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
                <Trophy className="w-8 h-8 text-green-400 mb-2" />
                <p className="text-white/60 text-sm">Wins</p>
                <p className="text-4xl font-bold text-white">{stats.wins}</p>
              </Card>
              <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
                <Target className="w-8 h-8 text-red-400 mb-2" />
                <p className="text-white/60 text-sm">Losses</p>
                <p className="text-4xl font-bold text-white">{stats.losses}</p>
              </Card>
              <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
                <TrendingUp className="w-8 h-8 text-purple-400 mb-2" />
                <p className="text-white/60 text-sm">Win Rate</p>
                <p className="text-4xl font-bold text-white">{stats.win_rate}%</p>
              </Card>
            </div>

            {/* Games by Type */}
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20 mb-8">
              <h2 className="text-2xl font-bold text-white mb-6">Games by Type</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {(Object.entries(stats.games_by_type || {}) as Array<[string, number]>).map(([gameType, count]) => (
                  <div key={gameType} className="bg-white/5 rounded-lg p-4">
                    <p className="text-white font-semibold capitalize mb-1">{gameType.replace('_', ' ')}</p>
                    <p className="text-3xl font-bold text-purple-300">{count}</p>
                    <p className="text-white/60 text-sm">games played</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Games by Difficulty */}
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <h2 className="text-2xl font-bold text-white mb-6">Games by Difficulty</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {(Object.entries(stats.games_by_difficulty || {}) as Array<[string, number]>).map(([difficulty, count]) => {
                  const colors: Record<string, string> = {
                    easy: 'green',
                    medium: 'yellow',
                    hard: 'red'
                  };
                  const color = colors[difficulty] || 'blue';
                  
                  return (
                    <div key={difficulty} className="bg-white/5 rounded-lg p-4">
                      <p className={`text-${color}-400 font-semibold capitalize mb-1`}>{difficulty}</p>
                      <p className="text-3xl font-bold text-white">{count}</p>
                      <p className="text-white/60 text-sm">games played</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
