import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, MessageCircle, Zap } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

export default function HttpMultiplayerTruthOrDare() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');

  const myRole = gameState?.my_role;
  const currentChallenge = gameState?.game_state?.current_challenge;
  const roundNumber = gameState?.game_state?.round_number || 1;
  const totalRounds = 5;
  const myCompleted = gameState?.game_state?.[`${myRole}_completed`] || 0;
  const opponentRole = myRole === 'player1' ? 'player2' : 'player1';
  const opponentCompleted = gameState?.game_state?.[`${opponentRole}_completed`] || 0;

  useEffect(() => {
    if (gameState?.status === 'completed') {
      if (myCompleted > opponentCompleted) {
        setLocalGameStatus('won');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      } else {
        setLocalGameStatus('lost');
      }
    }
  }, [gameState, myCompleted, opponentCompleted, setLocalGameStatus, setShowConfetti]);

  const handleChoice = async (choice) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;

    await makeMove({ choice }, {
      ...gameState.game_state,
      [`${myRole}_choice`]: choice,
      [`${myRole}_completed`]: myCompleted + 1,
      round_number: roundNumber + 1
    });

    if (roundNumber >= totalRounds) {
      const winner = myCompleted + 1 > opponentCompleted ? myRole : opponentRole;
      await endGame(winner);
    }
  };

  const handleCompleted = async (completed) => {
    await makeMove({ completed }, {
      ...gameState.game_state,
      [`${myRole}_completed`]: myCompleted + (completed ? 1 : 0)
    });
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-fuchsia-900 via-purple-900 to-pink-900 text-white flex items-center justify-center">
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
        gameLabel="Truth or Dare"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="truthordare-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-fuchsia-900 via-purple-900 to-pink-900 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="max-w-4xl mx-auto relative z-10">
        

        {/* Score Board */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className={`p-4 ${myRole === 'player1' ? 'bg-fuchsia-600/30 border-fuchsia-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player1Name}</p>
            <p className="text-3xl font-black text-fuchsia-400">{myRole === 'player1' ? myCompleted : opponentCompleted}</p>
            <p className="text-xs text-gray-300">completed</p>
          </Card>
          <Card className={`p-4 ${myRole === 'player2' ? 'bg-fuchsia-600/30 border-fuchsia-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player2Name}</p>
            <p className="text-3xl font-black text-fuchsia-400">{myRole === 'player2' ? myCompleted : opponentCompleted}</p>
            <p className="text-xs text-gray-300">completed</p>
          </Card>
        </div>

        {/* Turn Indicator */}
        {localGameStatus === 'playing' && (
          <Card className={`p-4 mb-6 ${isMyTurn ? 'bg-green-600' : 'bg-gray-700'}`}>
            <p className="text-xl font-black text-center">
              {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}
            </p>
          </Card>
        )}

        {/* Challenge Card */}
        {currentChallenge && isMyTurn && localGameStatus === 'playing' ? (
          <Card className="bg-gradient-to-br from-fuchsia-600 to-pink-600 p-8 mb-6 text-center">
            <div className="text-6xl mb-4">{currentChallenge.type === 'truth' ? '🤔' : '🔥'}</div>
            <h2 className="text-2xl font-bold mb-4">{currentChallenge.type === 'truth' ? 'TRUTH' : 'DARE'}</h2>
            <p className="text-xl mb-6">{currentChallenge.question || currentChallenge.dare}</p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => handleCompleted(true)} className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6">
                ✅ Completed!
              </Button>
              <Button onClick={() => handleCompleted(false)} className="bg-red-600 hover:bg-red-700 text-lg px-8 py-6">
                ❌ Skip
              </Button>
            </div>
          </Card>
        ) : !isMyTurn && localGameStatus === 'playing' ? (
          <Card className="bg-white/10 p-8 mb-6 text-center">
            <div className="text-6xl mb-4 animate-pulse">🤫</div>
            <p className="text-2xl font-bold">Waiting for {opponent?.name || 'opponent'}...</p>
          </Card>
        ) : isMyTurn && !currentChallenge && localGameStatus === 'playing' ? (
          <Card className="bg-white/10 p-8 mb-6">
            <h2 className="text-2xl font-bold text-center mb-6">Choose Your Challenge</h2>
            <div className="grid grid-cols-2 gap-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleChoice('truth')}
                className="bg-gradient-to-br from-blue-600 to-purple-600 p-8 rounded-2xl hover:shadow-2xl transition-all"
              >
                <MessageCircle className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-2xl font-black">TRUTH</h3>
                <p className="text-sm mt-2">Answer honestly</p>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleChoice('dare')}
                className="bg-gradient-to-br from-red-600 to-orange-600 p-8 rounded-2xl hover:shadow-2xl transition-all"
              >
                <Zap className="w-16 h-16 mx-auto mb-4" />
                <h3 className="text-2xl font-black">DARE</h3>
                <p className="text-sm mt-2">Complete the challenge</p>
              </motion.button>
            </div>
          </Card>
        ) : null}

        {/* Game Result */}
        <AnimatePresence>
          {localGameStatus !== 'playing' && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
              <Card className={`inline-block px-8 py-6 ${localGameStatus === 'won' ? 'bg-green-600' : 'bg-red-600'}`}>
                <div className="text-6xl mb-4">{localGameStatus === 'won' ? '🏆' : '😢'}</div>
                <h2 className="text-3xl font-black">{localGameStatus === 'won' ? 'YOU WIN!' : 'YOU LOSE!'}</h2>
                <p className="text-lg">Final: {myCompleted} - {opponentCompleted}</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-4 justify-center">
          <Button onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-gray-700">
            <ArrowLeft className="w-5 h-5 mr-2" />Leave Game
          </Button>
          {localGameStatus !== 'playing' && (
            <Button onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-cyan-600">
              🔄 Play Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
