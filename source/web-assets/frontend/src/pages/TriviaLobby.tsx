import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Brain, Trophy, Play, ArrowLeft, Star, Target } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TriviaLobby() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('mixed');
  const [selectedDifficulty, setSelectedDifficulty] = useState('mixed');
  const [numQuestions, setNumQuestions] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch categories
      const catRes = await fetch(`${API}/api/trivia/categories`);
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }

      // Fetch user stats
      const statsRes = await fetch(`${API}/api/trivia/stats`, {
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      // console.error('Error fetching data:', err);
    }
  };

  const startGame = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API}/api/trivia/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          category: selectedCategory,
          num_questions: numQuestions,
          difficulty: selectedDifficulty
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start game');
      }

      const data = await response.json();
      navigate(`/trivia/play/${data.game_id}`);
    } catch (err) {
      // console.error('Error starting game:', err);
      alert('Failed to start game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/games')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Games
          </Button>
          <div className="flex items-center gap-4 mb-4">
            <Brain className="w-12 h-12 text-blue-300" />
            <div>
              <h1 className="text-4xl font-bold text-white">Trivia Challenge</h1>
              <p className="text-blue-200">Test your knowledge across multiple categories!</p>
            </div>
          </div>
        </div>

        {/* User Stats */}
        {stats && stats.total_games > 0 && (
          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 bg-white/10 backdrop-blur-lg border-white/20">
              <Target className="w-6 h-6 text-green-400 mb-2" />
              <p className="text-white/60 text-sm">Games Played</p>
              <p className="text-2xl font-bold text-white">{stats.total_games}</p>
            </Card>
            <Card className="p-4 bg-white/10 backdrop-blur-lg border-white/20">
              <Star className="w-6 h-6 text-yellow-400 mb-2" />
              <p className="text-white/60 text-sm">Best Score</p>
              <p className="text-2xl font-bold text-white">{stats.best_score}</p>
            </Card>
            <Card className="p-4 bg-white/10 backdrop-blur-lg border-white/20">
              <Trophy className="w-6 h-6 text-purple-400 mb-2" />
              <p className="text-white/60 text-sm">Accuracy</p>
              <p className="text-2xl font-bold text-white">{stats.accuracy}%</p>
            </Card>
            <Card className="p-4 bg-white/10 backdrop-blur-lg border-white/20">
              <Brain className="w-6 h-6 text-blue-400 mb-2" />
              <p className="text-white/60 text-sm">Avg Score</p>
              <p className="text-2xl font-bold text-white">{stats.average_score}</p>
            </Card>
          </div>
        )}

        {/* Game Setup */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Configuration Card */}
          <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">Setup Your Game</h2>

            {/* Category Selection */}
            <div className="mb-6">
              <label className="text-white font-semibold mb-3 block">Select Category:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedCategory('mixed')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedCategory === 'mixed'
                      ? 'border-blue-400 bg-blue-500/30'
                      : 'border-white/20 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <p className="text-2xl mb-1">🎯</p>
                  <p className="text-white font-semibold text-sm">Mixed</p>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedCategory === cat.id
                        ? 'border-blue-400 bg-blue-500/30'
                        : 'border-white/20 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-2xl mb-1">{cat.emoji}</p>
                    <p className="text-white font-semibold text-xs">{cat.name}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty Selection */}
            <div className="mb-6">
              <label className="text-white font-semibold mb-3 block">Difficulty:</label>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { value: 'mixed', label: 'Mixed', color: 'blue' },
                  { value: 'easy', label: 'Easy', color: 'green' },
                  { value: 'medium', label: 'Medium', color: 'yellow' },
                  { value: 'hard', label: 'Hard', color: 'red' }
                ].map((diff) => (
                  <button
                    key={diff.value}
                    onClick={() => setSelectedDifficulty(diff.value)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedDifficulty === diff.value
                        ? `border-${diff.color}-400 bg-${diff.color}-500/30`
                        : 'border-white/20 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <p className="text-white font-semibold text-sm">{diff.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Questions */}
            <div className="mb-6">
              <label className="text-white font-semibold mb-3 block">
                Number of Questions: <span className="text-blue-300">{numQuestions}</span>
              </label>
              <input
                type="range"
                min="5"
                max="20"
                step="5"
                value={numQuestions}
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-white/60 text-sm mt-1">
                <span>5</span>
                <span>10</span>
                <span>15</span>
                <span>20</span>
              </div>
            </div>

            {/* Start Button */}
            <Button
              onClick={startGame}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-6 text-lg"
            >
              <Play className="mr-2 h-5 w-5" />
              {loading ? 'Starting...' : 'Start Game'}
            </Button>
          </Card>

          {/* Leaderboard & Instructions */}
          <div className="space-y-6">
            {/* Instructions */}
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">How to Play</h3>
              <ul className="space-y-3 text-white/80">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">1.</span>
                  <span>Choose your category and difficulty level</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">2.</span>
                  <span>Select the number of questions (5-20)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">3.</span>
                  <span>Answer each question by clicking your choice</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">4.</span>
                  <span>Earn points: Easy (10pts), Medium (15pts), Hard (20pts)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400">5.</span>
                  <span>Compete for the top score on the leaderboard!</span>
                </li>
              </ul>
            </Card>

            {/* Quick Actions */}
            <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/trivia/leaderboard')}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  View Leaderboard
                </Button>
                <Button
                  onClick={() => navigate('/games')}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  More Games
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
