
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heart, Trophy, MessageCircle, Smile, ThumbsUp, Laugh, Lightbulb, ArrowLeft, Send } from 'lucide-react';
import AppFooter from '@/components/AppFooter';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay, { ConfettiCelebration } from '@/components/ParticleEffectsOverlay';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PartnerQuizGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  // AAA Card Juice
  const [showConfetti, setShowConfetti] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null);

  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dating-games/game/${gameId}`, {
      });
      if (response.ok) {
        const data = await response.json();
        setGame(data);
        if (data.status === 'completed') {
          setShowResults(true);
        }
      }
    } catch (error) {
      // console.error('Error fetching game:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentAnswer.trim()) return;

    // AAA Card Juice
    cardSoundManager.playCardSlam();
    setParticleTrigger({ x: window.innerWidth / 2, y: window.innerHeight / 2, color: '#f472b6' });
    setTimeout(() => setParticleTrigger(null), 100);

    try {
      const response = await fetch(`${API_URL}/api/dating-games/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          game_id: gameId,
          question_id: game.questions[game.current_question].id,
          answer: currentAnswer,
          player_id: 'current_user' // Will be set by backend
        })
      });

      if (response.ok) {
        setCurrentAnswer('');
        fetchGame();
      }
    } catch (error) {
      // console.error('Error submitting answer:', error);
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;

    try {
      await fetch(`${API_URL}/api/dating-games/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          game_id: gameId,
          message: chatMessage,
          sender_id: 'current_user'
        })
      });
      setChatMessage('');
      fetchGame();
    } catch (error) {
      // console.error('Error sending chat:', error);
    }
  };

  const sendReaction = async (reaction) => {
    try {
      await fetch(`${API_URL}/api/dating-games/reaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          game_id: gameId,
          reaction: reaction,
          sender_id: 'current_user'
        })
      });
    } catch (error) {
      // console.error('Error sending reaction:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-red-900 flex items-center justify-center">
        <p className="text-white text-2xl">Loading game...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-red-900 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-xl mb-4">Game not found</p>
          <Button onClick={() => navigate('/tournaments')}>Back to Tournaments</Button>
        </Card>
      </div>
    );
  }

  const currentQuestion = game.questions[game.current_question];

  if (showResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-red-900 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 bg-white/10 backdrop-blur-lg border-2 border-white/20 text-center">
            <Trophy className="w-24 h-24 mx-auto mb-6 text-yellow-300" />
            <h1 className="text-5xl font-bold text-white mb-4">Game Complete! 🎉</h1>
            
            <div className="grid grid-cols-2 gap-8 my-12">
              <div className="bg-pink-500/20 rounded-xl p-8 border-2 border-pink-300/30">
                <h3 className="text-3xl font-bold text-white mb-2">Couple 1</h3>
                <p className="text-6xl font-black text-pink-300">{game.scores.couple_1}</p>
                <p className="text-white/70 mt-2">points</p>
              </div>
              <div className="bg-purple-500/20 rounded-xl p-8 border-2 border-purple-300/30">
                <h3 className="text-3xl font-bold text-white mb-2">Couple 2</h3>
                <p className="text-6xl font-black text-purple-300">{game.scores.couple_2}</p>
                <p className="text-white/70 mt-2">points</p>
              </div>
            </div>

            {game.game_type === 'compatibility' && (
              <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-xl p-8 mb-8">
                <h3 className="text-2xl font-bold text-white mb-3">💕 Compatibility Score</h3>
                <div className="text-6xl font-black text-pink-300">{game.compatibility_score}%</div>
                <p className="text-white/70 mt-3">
                  {game.compatibility_score > 80 ? 'Amazing match!' : 
                   game.compatibility_score > 60 ? 'Great compatibility!' : 
                   game.compatibility_score > 40 ? 'Good potential!' : 
                   'Opposites attract!'}
                </p>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => navigate('/tournaments')}
                className="bg-gradient-to-r from-pink-500 to-purple-500"
              >
                Back to Tournaments
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Play Again
              </Button>
            </div>
          </Card>
        </div>
        <AppFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-900 via-purple-900 to-red-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <Button
            onClick={() => navigate('/tournaments')}
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Leave Game
          </Button>
          <div className="text-white text-center">
            <p className="text-sm opacity-70">Question {game.current_question + 1} of {game.questions.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-3">
            {/* Score Display */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="p-6 bg-pink-500/20 backdrop-blur-lg border-2 border-pink-300/30">
                <div className="text-center">
                  <h3 className="text-white font-bold mb-2">💕 Couple 1</h3>
                  <p className="text-4xl font-black text-pink-300">{game.scores.couple_1}</p>
                </div>
              </Card>
              <Card className="p-6 bg-purple-500/20 backdrop-blur-lg border-2 border-purple-300/30">
                <div className="text-center">
                  <h3 className="text-white font-bold mb-2">💜 Couple 2</h3>
                  <p className="text-4xl font-black text-purple-300">{game.scores.couple_2}</p>
                </div>
              </Card>
            </div>

            {/* Question Card */}
            <Card className="p-12 bg-white/10 backdrop-blur-lg border-2 border-white/20 mb-6">
              <div className="text-center mb-8">
                <div className="inline-block bg-gradient-to-r from-pink-500 to-purple-500 rounded-full px-6 py-2 mb-6">
                  <span className="text-white font-bold text-sm uppercase tracking-wider">
                    {game.game_type.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="text-4xl font-bold text-white mb-4">
                  {currentQuestion.question}
                </h2>
                {currentQuestion.options && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    {currentQuestion.options.map((option, idx) => (
                      <Button
                        key={`options-${idx}`}
                        onClick={() => setCurrentAnswer(option)}
                        className={`p-6 text-lg ${
                          currentAnswer === option
                            ? 'bg-gradient-to-r from-pink-500 to-purple-500'
                            : 'bg-white/10 hover:bg-white/20'
                        } text-white border-2 border-white/20`}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Text Answer Input */}
              {!currentQuestion.options && (
                <div className="max-w-2xl mx-auto">
                  <textarea
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="w-full px-6 py-4 border-2 border-white/20 rounded-lg bg-white/10 text-white placeholder-white/50 focus:border-pink-400 focus:outline-none text-lg"
                    rows={3}
                  />
                </div>
              )}

              {/* Submit Button */}
              <div className="text-center mt-8">
                <Button
                  onClick={submitAnswer}
                  disabled={!currentAnswer}
                  className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 px-12 py-6 text-xl"
                >
                  Submit Answer
                </Button>
              </div>
            </Card>

            {/* Reactions */}
            <div className="flex justify-center gap-4">
              <Button onClick={() => sendReaction('love')} className="bg-white/10 hover:bg-white/20">
                <Heart className="w-6 h-6 text-red-400" />
              </Button>
              <Button onClick={() => sendReaction('laugh')} className="bg-white/10 hover:bg-white/20">
                <Laugh className="w-6 h-6 text-yellow-400" />
              </Button>
              <Button onClick={() => sendReaction('surprise')} className="bg-white/10 hover:bg-white/20">
                <Smile className="w-6 h-6 text-blue-400" />
              </Button>
              <Button onClick={() => sendReaction('thinking')} className="bg-white/10 hover:bg-white/20">
                <Lightbulb className="w-6 h-6 text-purple-400" />
              </Button>
            </div>
          </div>

          {/* Chat Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-4 bg-white/10 backdrop-blur-lg border border-white/20 h-[600px] flex flex-col">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Live Chat
              </h3>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-4">
                {game.chat_messages.map((msg) => (
                  <div key={msg.message_id} className="bg-white/10 rounded-lg p-3">
                    <p className="text-white text-sm">{msg.message}</p>
                    <p className="text-white/50 text-xs mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Say something..."
                  className="flex-1 px-3 py-2 border border-white/20 rounded-lg bg-white/10 text-white placeholder-white/50 focus:border-pink-400 focus:outline-none text-sm"
                />
                <Button onClick={sendChatMessage} size="sm" className="bg-pink-500 hover:bg-pink-600">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* AAA Card Juice */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger} />
      <ConfettiCelebration active={showConfetti} />

      <AppFooter />
    </div>
  );
}
