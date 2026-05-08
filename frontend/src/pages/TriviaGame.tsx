import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, XCircle, Loader, Award } from 'lucide-react';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay, { ConfettiCelebration } from '@/components/ParticleEffectsOverlay';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TriviaGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // AAA Card Juice
  const [showConfetti, setShowConfetti] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null);

  useEffect(() => {
    fetchGameState();
  }, [gameId]);

  const fetchGameState = async () => {
    try {
      const response = await fetch(`${API}/api/trivia/game/${gameId}`, {
      });

      if (!response.ok) {
        throw new Error('Failed to fetch game');
      }

      const data = await response.json();
      
      if (data.status === 'completed') {
        navigate(`/trivia/results/${gameId}`);
        return;
      }

      setGameState(data);
      setCurrentQuestion(data.current_question);
      setLoading(false);
    } catch (err) {
      // console.error('Error fetching game:', err);
      alert('Failed to load game');
      navigate('/trivia');
    }
  };

  const submitAnswer = async () => {
    if (!selectedAnswer || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${API}/api/trivia/game/${gameId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          question_id: currentQuestion.id,
          user_answer: selectedAnswer,
          time_taken: 0
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await response.json();
      setFeedback(data);
      setShowFeedback(true);

      // AAA Card Juice - Sound + particles based on correctness
      if (data.is_correct) {
        cardSoundManager.playWinSound();
        setParticleTrigger({ x: window.innerWidth / 2, y: window.innerHeight / 2, color: '#22c55e' });
        
        // Confetti on game complete with high score
        if (data.game_completed && data.new_score >= 80) {
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 4000);
        }
      } else {
        setParticleTrigger({ x: window.innerWidth / 2, y: window.innerHeight / 2, color: '#ef4444' });
      }
      setTimeout(() => setParticleTrigger(null), 100);

      // Auto-advance after 3 seconds
      setTimeout(() => {
        if (data.game_completed) {
          navigate(`/trivia/results/${gameId}`);
        } else {
          setCurrentQuestion(data.next_question);
          setGameState(prev => ({
            ...prev,
            score: data.new_score,
            current_question: data.next_question
          }));
          setSelectedAnswer(null);
          setShowFeedback(false);
          setFeedback(null);
        }
      }, 3000);
    } catch (err) {
      // console.error('Error submitting answer:', err);
      alert('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Loader className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <p className="text-white text-xl">Loading question...</p>
      </div>
    );
  }

  const difficultyColors = {
    easy: 'bg-green-500',
    medium: 'bg-yellow-500',
    hard: 'bg-red-500'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header - Score & Progress */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Award className="w-8 h-8 text-yellow-400" />
            <div>
              <p className="text-white/60 text-sm">Current Score</p>
              <p className="text-3xl font-bold text-white">{gameState.score}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm">Progress</p>
            <p className="text-2xl font-bold text-white">
              {currentQuestion.question_number} / {currentQuestion.total_questions}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/20 rounded-full h-2 mb-8">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(currentQuestion.question_number / currentQuestion.total_questions) * 100}%`
            }}
          />
        </div>

        {/* Question Card */}
        <Card className="p-8 bg-white/10 backdrop-blur-lg border-white/20 mb-6">
          {/* Category & Difficulty */}
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 rounded-full bg-blue-500/30 text-blue-200 text-sm font-semibold">
              {currentQuestion.category}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-white text-sm font-semibold ${
                difficultyColors[currentQuestion.difficulty]
              }`}
            >
              {currentQuestion.difficulty}
            </span>
          </div>

          {/* Question */}
          <h2 className="text-2xl font-bold text-white mb-8">
            {currentQuestion.question}
          </h2>

          {/* Answer Options */}
          <div className="space-y-4">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedAnswer === option.id;
              const isCorrect = feedback && option.id === feedback.correct_answer;
              const isWrong = feedback && isSelected && !feedback.is_correct;

              let buttonClass = 'border-white/20 bg-white/5 hover:bg-white/10 text-white';
              
              if (showFeedback) {
                if (isCorrect) {
                  buttonClass = 'border-green-400 bg-green-500/30 text-white';
                } else if (isWrong) {
                  buttonClass = 'border-red-400 bg-red-500/30 text-white';
                } else {
                  buttonClass = 'border-white/10 bg-white/5 text-white/50';
                }
              } else if (isSelected) {
                buttonClass = 'border-blue-400 bg-blue-500/30 text-white';
              }

              return (
                <button
                  key={option.id}
                  onClick={() => !showFeedback && setSelectedAnswer(option.id)}
                  disabled={showFeedback}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left font-semibold flex items-center justify-between ${buttonClass}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-lg">{option.id.toUpperCase()}.</span>
                    <span>{option.text}</span>
                  </span>
                  {showFeedback && isCorrect && (
                    <CheckCircle className="w-6 h-6 text-green-400" />
                  )}
                  {showFeedback && isWrong && (
                    <XCircle className="w-6 h-6 text-red-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {showFeedback && feedback && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                feedback.is_correct
                  ? 'bg-green-500/20 border border-green-500/30'
                  : 'bg-red-500/20 border border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {feedback.is_correct ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400" />
                )}
                <p className="text-white font-bold">
                  {feedback.is_correct ? 'Correct!' : 'Incorrect'}
                </p>
                <span className="ml-auto text-yellow-400 font-bold">
                  +{feedback.points_earned} points
                </span>
              </div>
              {feedback.explanation && (
                <p className="text-white/80 text-sm mt-2">{feedback.explanation}</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          {!showFeedback && (
            <Button
              onClick={submitAnswer}
              disabled={!selectedAnswer || submitting}
              className="w-full mt-6 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-bold py-4 text-lg disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Answer'}
            </Button>
          )}
        </Card>

        {/* AAA Card Juice */}
        <ParticleEffectsOverlay triggerSparkle={particleTrigger} />
        <ConfettiCelebration active={showConfetti} />
      </div>
    </div>
  );
}
