
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Crown, ArrowLeft, Zap, Clock } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

export default function HttpMultiplayerTrivia() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const {
    connected,
    gameId,
    gameState,
    isMyTurn,
    opponent,
    error,
    makeMove,
    endGame,
    leaveGame,
    clearError
  } = useHttpMultiplayer(userId, userName, urlGameId);

  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [showConfetti, setShowConfetti] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');

  const myRole = gameState?.my_role;
  const currentQuestion = gameState?.game_state?.current_question;
  const questionIndex = gameState?.game_state?.question_index || 0;
  const playerScore = gameState?.game_state?.player_scores?.[myRole] || 0;
  const opponentRole = myRole === 'player1' ? 'player2' : 'player1';
  const opponentScore = gameState?.game_state?.player_scores?.[opponentRole] || 0;
  const totalQuestions = 10;

  // Timer countdown
  useEffect(() => {
    if (!isMyTurn || !currentQuestion || localGameStatus !== 'playing') {
      return;
    }
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - auto submit null answer
          handleAnswerSubmit(null);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isMyTurn, currentQuestion, localGameStatus]);

  // Reset timer when question changes
  useEffect(() => {
    setTimeRemaining(15);
    setSelectedAnswer(null);
  }, [questionIndex]);

  // Check for game end
  useEffect(() => {
    if (gameState?.status === 'completed') {
      handleGameEnd();
    }
  }, [gameState]);

  const handleAnswerSubmit = async (answer: string | null) => {
    if (!currentQuestion) return;
    
    const isCorrect = answer === currentQuestion.correct_answer;
    const timeTaken = 15 - timeRemaining;
    
    await makeMove({
      answer,
      question_index: questionIndex,
      is_correct: isCorrect,
      time_taken: timeTaken
    }, {
      current_question: null,
      question_index: questionIndex + 1,
      player_scores: {
        ...gameState.game_state.player_scores,
        [myRole]: playerScore + (isCorrect ? 1 : 0)
      }
    });

    // Check if game should end
    if (questionIndex + 1 >= totalQuestions) {
      const finalPlayerScore = playerScore + (isCorrect ? 1 : 0);
      const winner = finalPlayerScore > opponentScore ? myRole : opponentRole;
      await endGame(winner);
    }
  };

  const handleGameEnd = () => {
    if (playerScore > opponentScore) {
      setLocalGameStatus('won');
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
    } else if (playerScore < opponentScore) {
      setLocalGameStatus('lost');
    } else {
      setLocalGameStatus('draw');
    }
  };

  const getShuffledAnswers = () => {
    if (!currentQuestion) return [];
    const answers = [
      currentQuestion.correct_answer,
      ...currentQuestion.incorrect_answers
    ];
    return answers.sort(() => Math.random() - 0.5);
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div>
          <h2 className="text-2xl font-bold mb-4">Loading game...</h2>
          <Button onClick={() => navigate('/http-multiplayer')}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  if (gameState.status === 'completed') {
    const serverWinner = gameState.winner;
    const iWon = serverWinner ? serverWinner === myRole : false;
    return (
      <WinCelebration
        won={iWon}
        gameId={gameId}
        userId={userId}
        gameLabel="Trivia"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="trivia-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        

        {/* Score Board */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className={`p-4 ${myRole === 'player1' ? 'bg-cyan-600/30 border-cyan-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
            <div className="text-center">
              <p className="font-bold text-lg">{player1Name}</p>
              <p className="text-3xl font-black text-cyan-400">{gameState.game_state.player_scores?.player1 || 0}</p>
              <p className="text-xs text-gray-300">points</p>
            </div>
          </Card>

          <Card className={`p-4 ${myRole === 'player2' ? 'bg-pink-600/30 border-pink-400 border-2' : 'bg-white/10 border-white/20'} backdrop-blur-xl`}>
            <div className="text-center">
              <p className="font-bold text-lg">{player2Name}</p>
              <p className="text-3xl font-black text-pink-400">{gameState.game_state.player_scores?.player2 || 0}</p>
              <p className="text-xs text-gray-300">points</p>
            </div>
          </Card>
        </div>

        {/* Timer & Turn Indicator */}
        {localGameStatus === 'playing' && (
          <Card className={`p-4 mb-6 ${isMyTurn ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gray-700'} backdrop-blur-xl border-2 ${isMyTurn ? 'border-green-400' : 'border-gray-500'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xl font-black">
                {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent Answering...'}
              </p>
              {isMyTurn && (
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span className="text-2xl font-bold">{timeRemaining}s</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Question & Answers */}
        {currentQuestion && isMyTurn && localGameStatus === 'playing' ? (
          <Card className="bg-white/10 backdrop-blur-xl border-2 border-cyan-500/30 p-6 mb-6">
            <h2 className="text-2xl font-bold mb-6 text-center">{currentQuestion.question}</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {getShuffledAnswers().map((answer, index) => (
                <motion.button
                  key={`item-${index}`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleAnswerSubmit(answer)}
                  className={`p-4 rounded-xl font-bold text-lg transition-all ${
                    selectedAnswer === answer
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-700 border-cyan-400 border-2'
                      : 'bg-white/20 border-white/30 border-2 hover:bg-white/30'
                  }`}
                >
                  {answer}
                </motion.button>
              ))}
            </div>
          </Card>
        ) : !isMyTurn && localGameStatus === 'playing' ? (
          <Card className="bg-white/10 backdrop-blur-xl border-2 border-gray-500/30 p-8 mb-6 text-center">
            <div className="text-6xl mb-4 animate-pulse">🤔</div>
            <p className="text-2xl font-bold">Waiting for {opponent?.name || 'opponent'} to answer...</p>
          </Card>
        ) : null}

        {/* Game Result */}
        <AnimatePresence>
          {localGameStatus !== 'playing' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center mb-6"
            >
              <Card className={`inline-block px-8 py-6 backdrop-blur-xl border-4 ${
                localGameStatus === 'won' ? 'bg-gradient-to-br from-green-600 to-emerald-600 border-green-400' :
                localGameStatus === 'lost' ? 'bg-gradient-to-br from-red-600 to-rose-600 border-red-400' :
                'bg-gradient-to-br from-yellow-600 to-orange-600 border-yellow-400'
              }`}>
                <div className="text-6xl mb-4">
                  {localGameStatus === 'won' ? '🏆' : localGameStatus === 'lost' ? '😢' : '🤝'}
                </div>
                <h2 className="text-3xl sm:text-4xl font-black mb-2">
                  {localGameStatus === 'won' ? 'YOU WIN!' : localGameStatus === 'lost' ? 'YOU LOSE!' : 'DRAW!'}
                </h2>
                <p className="text-lg text-white/90">
                  Final Score: {playerScore} - {opponentScore}
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => { leaveGame(); navigate('/http-multiplayer'); }}
            className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 font-bold text-lg py-6 px-8 rounded-xl"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Leave Game
          </Button>
          
          {localGameStatus !== 'playing' && (
            <Button
              onClick={() => { leaveGame(); navigate('/http-multiplayer'); }}
              className="bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 font-bold text-lg py-6 px-8 rounded-xl"
            >
              🔄 Play Again
            </Button>
          )}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 max-w-md mx-auto bg-red-600 text-white px-4 py-3 rounded-lg flex justify-between items-center"
            >
              <span>{error}</span>
              <button onClick={clearError} className="text-white hover:text-gray-200">✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
