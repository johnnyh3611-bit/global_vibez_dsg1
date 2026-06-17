import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, CheckCircle, XCircle, ArrowLeft, RefreshCw, Share2, Star } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TriviaResults() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [gameId]);

  const fetchResults = async () => {
    try {
      const response = await fetch(`${API}/api/trivia/game/${gameId}/results`, {
      });

      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }

      const data = await response.json();
      setResults(data);
      setLoading(false);
    } catch (err) {
      // console.error('Error fetching results:', err);
      alert('Failed to load results');
      navigate('/trivia');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-white text-2xl">Loading results...</div>
      </div>
    );
  }

  if (!results) return null;

  const getRankEmoji = (percentage) => {
    if (percentage >= 90) return '🏆';
    if (percentage >= 75) return '🥇';
    if (percentage >= 60) return '🥈';
    if (percentage >= 50) return '🥉';
    return '📚';
  };

  const getRankMessage = (percentage) => {
    if (percentage >= 90) return 'Outstanding!';
    if (percentage >= 75) return 'Excellent Work!';
    if (percentage >= 60) return 'Good Job!';
    if (percentage >= 50) return 'Not Bad!';
    return 'Keep Practicing!';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Button
          onClick={() => navigate('/trivia')}
          variant="ghost"
          className="text-white hover:bg-white/10 mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Lobby
        </Button>

        {/* Results Card */}
        <Card className="p-8 bg-white/10 backdrop-blur-lg border-white/20 mb-6 text-center">
          <div className="text-6xl mb-4">{getRankEmoji(results.percentage)}</div>
          <h1 className="text-4xl font-bold text-white mb-2">Game Complete!</h1>
          <p className="text-2xl text-blue-200 mb-8">{getRankMessage(results.percentage)}</p>

          {/* Score Display */}
          <div className="bg-white/5 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <p className="text-5xl font-bold text-white">{results.score}</p>
            </div>
            <p className="text-white/60">Total Points</p>
          </div>

          {/* Stats Grid */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white/5 rounded-lg p-4">
              <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{results.correct_answers}</p>
              <p className="text-white/60 text-sm">Correct</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{results.incorrect_answers}</p>
              <p className="text-white/60 text-sm">Incorrect</p>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <Star className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{results.percentage}%</p>
              <p className="text-white/60 text-sm">Accuracy</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <Button
              onClick={() => navigate('/trivia')}
              className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-4"
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              Play Again
            </Button>
            <Button
              onClick={() => navigate('/trivia/leaderboard')}
              variant="outline"
              className="flex-1 border-white/20 text-white hover:bg-white/10 py-4"
            >
              <Trophy className="mr-2 h-5 w-5" />
              Leaderboard
            </Button>
          </div>
        </Card>

        {/* Answer Review */}
        <Card className="p-6 bg-white/10 backdrop-blur-lg border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">Answer Review</h2>
          <div className="space-y-4">
            {results.answers_detail.map((answer, index) => (
              <div
                key={`answers_detail-${index}`}
                className={`p-4 rounded-lg border-2 ${
                  answer.is_correct
                    ? 'border-green-500/30 bg-green-500/10'
                    : 'border-red-500/30 bg-red-500/10'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {answer.is_correct ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className="text-white font-semibold">Question {index + 1}</span>
                  </div>
                  <span className="text-yellow-400 font-bold">+{answer.points} pts</span>
                </div>
                {!answer.is_correct && (
                  <div className="text-sm text-white/80 mt-2">
                    <p>Your answer: <span className="text-red-300">{answer.user_answer.toUpperCase()}</span></p>
                    <p>Correct answer: <span className="text-green-300">{answer.correct_answer.toUpperCase()}</span></p>
                  </div>
                )}
                {answer.explanation && (
                  <p className="text-white/70 text-sm mt-2 italic">{answer.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
