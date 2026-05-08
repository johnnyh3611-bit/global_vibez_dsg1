import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Sparkles, TrendingUp, History, Users, CheckCircle } from 'lucide-react';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay, { ConfettiCelebration } from '@/components/ParticleEffectsOverlay';

const API = process.env.REACT_APP_BACKEND_URL;

export default function WouldYouRather() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [voteStats, setVoteStats] = useState(null);
  
  // AAA Card Juice
  const [showConfetti, setShowConfetti] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null);
  const [myHistory, setMyHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    fetchRandomQuestion();
    fetchMyHistory();
  }, []);

  const fetchRandomQuestion = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/games/would-you-rather/random`, {
      });

      if (!response.ok) throw new Error('Failed to fetch question');

      const data = await response.json();
      setCurrentQuestion(data.question);
      setSelectedOption(null);
      setShowResults(false);
      setVoteStats(null);
    } catch (err) {
      // console.error('Error fetching question:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyHistory = async () => {
    try {
      const response = await fetch(`${API}/api/games/would-you-rather/my-votes?limit=10`, {
      });

      if (!response.ok) return;

      const data = await response.json();
      setMyHistory(data);
    } catch (err) {
      // console.error('Error fetching history:', err);
    }
  };

  const handleVote = async (choice) => {
    if (animating || showResults) return;

    setAnimating(true);
    setSelectedOption(choice);

    // AAA Card Juice - Particles on vote
    cardSoundManager.playCardSlam();
    setParticleTrigger({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      color: choice === 'a' ? '#3b82f6' : '#ec4899'
    });
    setTimeout(() => setParticleTrigger(null), 100);

    try {
      const response = await fetch(`${API}/api/games/would-you-rather/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          choice: choice
        })
      });

      if (!response.ok) throw new Error('Vote failed');

      const result = await response.json();
      
      // Show results with animation
      setTimeout(() => {
        setVoteStats(result.statistics);
        setShowResults(true);
        setAnimating(false);
      }, 800);

      // Update history
      fetchMyHistory();
    } catch (err) {
      // console.error('Error voting:', err);
      setAnimating(false);
    }
  };

  const handleNextQuestion = () => {
    fetchRandomQuestion();
  };

  if (loading && !currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
        <div className="text-white text-2xl flex items-center gap-3">
          <Sparkles className="w-8 h-8 animate-spin" />
          Loading question...
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <Button
              onClick={() => setShowHistory(false)}
              variant="ghost"
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Game
            </Button>
            <h1 className="text-3xl font-bold text-white">Your History</h1>
            <div className="w-24"></div>
          </div>

          {/* History List */}
          <div className="space-y-4">
            {myHistory.length === 0 ? (
              <Card className="p-8 text-center bg-white/10 backdrop-blur-lg border-white/20">
                <p className="text-white text-lg">No voting history yet. Start playing!</p>
              </Card>
            ) : (
              myHistory.map((vote, index) => (
                <Card key={`myHistory-${index}`} className="p-6 bg-white/10 backdrop-blur-lg border-white/20 hover:bg-white/20 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold mb-2">{vote.question_text}</p>
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className={`p-3 rounded-lg ${vote.choice === 'a' ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-white/10'}`}>
                          <p className="text-white text-sm">{vote.option_a_text}</p>
                        </div>
                        <div className={`p-3 rounded-lg ${vote.choice === 'b' ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-white/10'}`}>
                          <p className="text-white text-sm">{vote.option_b_text}</p>
                        </div>
                      </div>
                      <p className="text-white/60 text-xs">
                        {new Date(vote.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button
            onClick={() => navigate('/games')}
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Games
          </Button>
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-yellow-300" />
            <h1 className="text-3xl font-bold text-white">Would You Rather?</h1>
          </div>
          <Button
            onClick={() => setShowHistory(true)}
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <History className="mr-2 h-4 w-4" />
            History
          </Button>
        </div>

        {/* Main Question Card */}
        <Card className="overflow-hidden shadow-2xl bg-white/10 backdrop-blur-lg border-white/20 mb-6">
          <div className="p-8">
            {/* Category Badge */}
            <div className="flex justify-center mb-6">
              <span className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-semibold uppercase tracking-wide">
                {currentQuestion?.category || 'General'}
              </span>
            </div>

            {/* Question */}
            <h2 className="text-center text-white text-3xl font-bold mb-8">
              {currentQuestion?.question}
            </h2>

            {/* Options */}
            {!showResults ? (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Option A */}
                <button
                  onClick={() => handleVote('a')}
                  disabled={animating}
                  className={`group relative p-8 rounded-2xl transition-all duration-300 ${
                    selectedOption === 'a'
                      ? 'bg-gradient-to-br from-green-400 to-emerald-500 scale-105'
                      : 'bg-gradient-to-br from-blue-500 to-cyan-500 hover:scale-105'
                  } ${animating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                    A
                  </div>
                  <p className="text-white text-xl font-semibold text-center mt-4">
                    {currentQuestion?.option_a}
                  </p>
                  {selectedOption === 'a' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                      <CheckCircle className="w-16 h-16 text-white animate-bounce" />
                    </div>
                  )}
                </button>

                {/* Option B */}
                <button
                  onClick={() => handleVote('b')}
                  disabled={animating}
                  className={`group relative p-8 rounded-2xl transition-all duration-300 ${
                    selectedOption === 'b'
                      ? 'bg-gradient-to-br from-green-400 to-emerald-500 scale-105'
                      : 'bg-gradient-to-br from-purple-500 to-pink-500 hover:scale-105'
                  } ${animating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xl">
                    B
                  </div>
                  <p className="text-white text-xl font-semibold text-center mt-4">
                    {currentQuestion?.option_b}
                  </p>
                  {selectedOption === 'b' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                      <CheckCircle className="w-16 h-16 text-white animate-bounce" />
                    </div>
                  )}
                </button>
              </div>
            ) : (
              /* Results View */
              <div className="space-y-6">
                <div className="flex items-center justify-center gap-2 mb-6">
                  <TrendingUp className="w-6 h-6 text-yellow-300" />
                  <h3 className="text-white text-2xl font-bold">Global Results</h3>
                  <Users className="w-6 h-6 text-yellow-300" />
                </div>

                {/* Option A Result */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold">A</span>
                      <span className="font-semibold">{currentQuestion?.option_a}</span>
                    </div>
                    <span className="text-2xl font-bold">{voteStats?.option_a?.percentage}%</span>
                  </div>
                  <div className="relative h-8 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full transition-all duration-1000 ${
                        selectedOption === 'a' ? 'shadow-lg shadow-blue-500/50' : ''
                      }`}
                      style={{ width: `${voteStats?.option_a?.percentage}%` }}
                    />
                  </div>
                  <p className="text-white/60 text-sm text-right">{voteStats?.option_a?.votes} votes</p>
                </div>

                {/* Option B Result */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center font-bold">B</span>
                      <span className="font-semibold">{currentQuestion?.option_b}</span>
                    </div>
                    <span className="text-2xl font-bold">{voteStats?.option_b?.percentage}%</span>
                  </div>
                  <div className="relative h-8 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full transition-all duration-1000 ${
                        selectedOption === 'b' ? 'shadow-lg shadow-purple-500/50' : ''
                      }`}
                      style={{ width: `${voteStats?.option_b?.percentage}%` }}
                    />
                  </div>
                  <p className="text-white/60 text-sm text-right">{voteStats?.option_b?.votes} votes</p>
                </div>

                {/* Total Votes */}
                <div className="pt-4 text-center">
                  <p className="text-white/80 text-lg">
                    <Users className="w-5 h-5 inline mr-2" />
                    Total Votes: <span className="font-bold text-yellow-300">{voteStats?.total_votes}</span>
                  </p>
                </div>

                {/* Next Question Button */}
                <Button
                  onClick={handleNextQuestion}
                  className="w-full mt-6 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold py-6 text-lg"
                >
                  Next Question
                  <ArrowLeft className="ml-2 h-5 w-5 rotate-180" />
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-4 bg-white/10 backdrop-blur-lg border-white/20">
          <p className="text-white/80 text-center text-sm">
            💡 Vote on fun dilemmas and see what others think! Every vote reveals global statistics.
          </p>
        </Card>

        {/* AAA Card Juice */}
        <ParticleEffectsOverlay triggerSparkle={particleTrigger} />
        <ConfettiCelebration active={showConfetti} />
      </div>
    </div>
  );
}
