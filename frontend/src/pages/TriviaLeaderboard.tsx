import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Medal, ArrowLeft, Filter, Star } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TriviaLeaderboard() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedCategory]);

  const fetchData = async () => {
    try {
      // Fetch categories
      const catRes = await fetch(`${API}/api/trivia/categories`);
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }
      
      fetchLeaderboard();
    } catch (err) {
      // console.error('Error fetching data:', err);
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const categoryParam = selectedCategory === 'all' ? '' : `?category=${selectedCategory}`;
      const response = await fetch(`${API}/api/trivia/leaderboard${categoryParam}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard');
      }

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      // console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-yellow-400" />;
    if (index === 1) return <Medal className="w-6 h-6 text-gray-300" />;
    if (index === 2) return <Medal className="w-6 h-6 text-orange-400" />;
    return <span className="text-white/60 font-bold">#{index + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/trivia')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Lobby
          </Button>
          <div className="flex items-center gap-4">
            <Trophy className="w-12 h-12 text-yellow-400" />
            <div>
              <h1 className="text-4xl font-bold text-white">Leaderboard</h1>
              <p className="text-blue-200">Top trivia masters</p>
            </div>
          </div>
        </div>

        {/* Category Filter */}
        <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Filter className="w-5 h-5 text-white" />
            <h3 className="text-white font-semibold">Filter by Category:</h3>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`p-3 rounded-lg border-2 transition-all ${
                selectedCategory === 'all'
                  ? 'border-blue-400 bg-blue-500/30'
                  : 'border-white/20 bg-white/5 hover:bg-white/10'
              }`}
            >
              <p className="text-white font-semibold text-sm">All</p>
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
                <p className="text-xl mb-1">{cat.emoji}</p>
                <p className="text-white font-semibold text-xs">{cat.name.split(' ')[0]}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Leaderboard List */}
        <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-white/80">Loading leaderboard...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-white/20" />
              <p className="text-white/80 text-lg">No games played yet</p>
              <p className="text-white/60 text-sm mt-2">Be the first to set a high score!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((entry, index) => (
                <div
                  key={entry.game_id}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    index < 3
                      ? 'border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="w-12 flex items-center justify-center">
                      {getRankIcon(index)}
                    </div>

                    {/* User Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-bold">{entry.user_name}</p>
                        {entry.percentage === 100 && (
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        )}
                      </div>
                      <p className="text-white/60 text-sm">
                        {entry.correct_answers}/{entry.total_questions} correct
                        {' • '}
                        {entry.percentage}%
                        {' • '}
                        <span className="capitalize">{entry.category}</span>
                      </p>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <p className="text-2xl font-bold text-yellow-400">{entry.score}</p>
                      <p className="text-white/60 text-sm">points</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Call to Action */}
        <div className="mt-6 text-center">
          <Button
            onClick={() => navigate('/trivia')}
            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold px-8 py-4"
          >
            Play Trivia
          </Button>
        </div>
      </div>
    </div>
  );
}
