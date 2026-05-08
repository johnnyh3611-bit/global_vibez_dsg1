import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Trophy, ArrowLeft, Users, Zap } from 'lucide-react';
import AppFooter from '@/components/AppFooter';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay, { ConfettiCelebration } from '@/components/ParticleEffectsOverlay';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CompatibilityGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // AAA Card Juice
  const [showConfetti, setShowConfetti] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null);

  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 3000);
    return () => clearInterval(interval);
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dating-games/game/${gameId}`, {
      });
      if (response.ok) {
        const data = await response.json();
        setGame(data);
      }
    } catch (error) {
      // console.error('Error fetching game:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer) => {
    setSelectedAnswer(answer);
    
    try {
      const response = await fetch(`${API_URL}/api/dating-games/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          game_id: gameId,
          question_id: game.questions[currentQuestionIndex].id,
          answer: answer,
          player_id: 'current_user'
        })
      });

      if (response.ok) {
        setTimeout(() => {
          setSelectedAnswer('');
          setCurrentQuestionIndex(prev => prev + 1);
          fetchGame();
        }, 2000);
      }
    } catch (error) {
      // console.error('Error submitting answer:', error);
    }
  };

  if (loading || !game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-red-900 flex items-center justify-center">
        <p className="text-white text-2xl">Loading...</p>
      </div>
    );
  }

  if (game.status === 'completed' || currentQuestionIndex >= game.questions.length) {
    const compatibilityScore = game.compatibility_score;
    const compatibilityLevel = 
      compatibilityScore >= 80 ? { text: 'Perfect Match!', color: 'text-pink-300', emoji: '💕💕💕' } :
      compatibilityScore >= 60 ? { text: 'Great Compatibility!', color: 'text-purple-300', emoji: '💜💜' } :
      compatibilityScore >= 40 ? { text: 'Good Potential!', color: 'text-blue-300', emoji: '💙' } :
      { text: 'Opposites Attract!', color: 'text-yellow-300', emoji: '⚡' };

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-red-900 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 bg-white/10 backdrop-blur-lg border-2 border-white/20 text-center">
            <div className="text-7xl mb-6">{compatibilityLevel.emoji}</div>
            <h1 className="text-5xl font-bold text-white mb-8">Compatibility Results</h1>
            
            {/* Compatibility Meter */}
            <div className="max-w-2xl mx-auto mb-12">
              <div className="relative h-32 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-pink-500 via-purple-500 to-red-500 transition-all duration-1000"
                  style={{ width: `${compatibilityScore}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl font-black text-white drop-shadow-lg">
                    {compatibilityScore}%
                  </span>
                </div>
              </div>
              <p className={`text-3xl font-bold mt-6 ${compatibilityLevel.color}`}>
                {compatibilityLevel.text}
              </p>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-gradient-to-br from-pink-500/20 to-red-500/20 rounded-xl p-6 border-2 border-pink-300/30">
                <Heart className="w-12 h-12 mx-auto mb-3 text-pink-300" />
                <h3 className="text-xl font-bold text-white mb-2">Lifestyle Match</h3>
                <p className="text-4xl font-black text-pink-300">{Math.floor(compatibilityScore * 0.9)}%</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl p-6 border-2 border-purple-300/30">
                <Users className="w-12 h-12 mx-auto mb-3 text-purple-300" />
                <h3 className="text-xl font-bold text-white mb-2">Values Alignment</h3>
                <p className="text-4xl font-black text-purple-300">{Math.floor(compatibilityScore * 1.1)}%</p>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-6 border-2 border-blue-300/30">
                <Zap className="w-12 h-12 mx-auto mb-3 text-blue-300" />
                <h3 className="text-xl font-bold text-white mb-2">Communication</h3>
                <p className="text-4xl font-black text-blue-300">{Math.floor(compatibilityScore * 0.95)}%</p>
              </div>
            </div>

            {/* Insights */}
            <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl p-8 mb-8 text-left">
              <h3 className="text-2xl font-bold text-white mb-4">💡 Compatibility Insights</h3>
              <div className="space-y-3 text-white/90">
                {compatibilityScore >= 70 && (
                  <>
                    <p>✨ You both share similar approaches to life and relationships</p>
                    <p>💬 Your communication styles complement each other well</p>
                    <p>🎯 You have aligned goals and values</p>
                  </>
                )}
                {compatibilityScore >= 40 && compatibilityScore < 70 && (
                  <>
                    <p>🌟 You have a good foundation with room to grow together</p>
                    <p>💭 Your differences can lead to interesting conversations</p>
                    <p>🤝 Compromise and understanding will strengthen your bond</p>
                  </>
                )}
                {compatibilityScore < 40 && (
                  <>
                    <p>⚡ Your differences create exciting dynamics</p>
                    <p>🎭 You bring contrasting perspectives that can balance each other</p>
                    <p>💫 Remember: opposites can attract and create beautiful relationships!</p>
                  </>
                )}
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => navigate('/couples-tournaments')}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 px-8 py-4 text-lg"
              >
                Back to Tournaments
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 px-8 py-4 text-lg"
              >
                Try Again
              </Button>
            </div>
          </Card>
        </div>
        <AppFooter />
      </div>
    );
  }

  const currentQuestion = game.questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-red-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <Button
            onClick={() => navigate('/couples-tournaments')}
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Leave Game
          </Button>
          <div className="text-white text-center">
            <p className="text-sm opacity-70">Question {currentQuestionIndex + 1} of {game.questions.length}</p>
            <div className="w-64 h-2 bg-white/20 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / game.questions.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-sm">Compatibility</p>
            <p className="text-3xl font-black text-pink-300">{game.compatibility_score}%</p>
          </div>
        </div>

        {/* Question Card */}
        <Card className="p-16 bg-white/10 backdrop-blur-lg border-2 border-white/20">
          <div className="text-center mb-12">
            <div className="inline-block bg-gradient-to-r from-pink-500 to-purple-500 rounded-full px-6 py-2 mb-8">
              <span className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4" />
                Compatibility Challenge
              </span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 leading-tight">
              {currentQuestion.question}
            </h2>
            
            <p className="text-white/70 text-lg mb-12">
              Choose the answer that best represents your preference
            </p>

            {/* Answer Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {currentQuestion.options.map((option, idx) => (
                <Button
                  key={`options-${idx}`}
                  onClick={() => submitAnswer(option)}
                  disabled={selectedAnswer !== ''}
                  className={`p-8 text-xl h-auto ${
                    selectedAnswer === option
                      ? 'bg-gradient-to-r from-pink-500 to-purple-500 scale-105'
                      : selectedAnswer !== ''
                      ? 'bg-white/5 opacity-50'
                      : 'bg-white/10 hover:bg-white/20 hover:scale-105'
                  } text-white border-2 border-white/20 transition-all duration-300`}
                >
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-4xl">
                      {idx === 0 ? '🌟' : idx === 1 ? '💫' : idx === 2 ? '✨' : '⭐'}
                    </span>
                    <span className="font-semibold">{option}</span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </Card>

        {/* Hint Text */}
        <div className="text-center mt-6">
          <p className="text-white/60 text-sm">
            Answer honestly to get the most accurate compatibility score
          </p>
        </div>

        {/* AAA Card Juice */}
        <ParticleEffectsOverlay triggerSparkle={particleTrigger} />
        <ConfettiCelebration active={showConfetti} />
      </div>
      <AppFooter />
    </div>
  );
}
