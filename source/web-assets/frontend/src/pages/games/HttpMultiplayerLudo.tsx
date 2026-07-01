
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Dices, BookOpen } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import GameRulesModal from '@/components/GameRulesModal';
import { GAME_RULES } from '@/config/gameRules';
import { useGameSounds } from '@/hooks/useGameSounds';
import { gameAnimations } from '@/utils/gameAnimations';

const LudoToken = ({ color, position, isHome }: { color?: any; position?: any; isHome?: any }) => {
  const colors = {
    red: 'bg-red-600 border-red-800',
    blue: 'bg-blue-600 border-blue-800',
    green: 'bg-green-600 border-green-800',
    yellow: 'bg-yellow-500 border-yellow-700'
  };
  
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: isHome ? 0.8 : 1 }}
      className={`w-8 h-8 rounded-full ${colors[color]} border-4 shadow-lg`}
    />
  );
};

export default function HttpMultiplayerLudo() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [diceValue, setDiceValue] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [showRules, setShowRules] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  
  // Sound effects
  const sounds = useGameSounds();

  const myRole = gameState?.my_role;
  const myColor = myRole === 'player1' ? 'red' : 'blue';
  const opponentColor = myColor === 'red' ? 'blue' : 'red';
  const positions = gameState?.game_state?.positions || { red: [0,0,0,0], blue: [0,0,0,0] };

  useEffect(() => {
    if (gameState?.status === 'completed') {
      if (gameState.winner === myRole) {
        setLocalGameStatus('won');
        setShowConfetti(true);
        sounds.playWin();
        setTimeout(() => setShowConfetti(false), 5000);
      } else {
        setLocalGameStatus('lost');
        sounds.playLose();
      }
    }
  }, [gameState, myRole, sounds]);

  const handleRollDice = async () => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    setIsRolling(true);
    sounds.playDiceRoll();
    
    const roll = Math.floor(Math.random() * 6) + 1;
    setDiceValue(roll);
    
    setTimeout(() => setIsRolling(false), 500);
    
    await makeMove({ action: 'roll', value: roll }, gameState.game_state);
  };

  const handleMoveToken = async (tokenIndex) => {
    if (!isMyTurn || !diceValue) return;
    
    sounds.playMove();
    
    const newPositions = { ...positions };
    newPositions[myColor][tokenIndex] += diceValue;
    
    await makeMove({ action: 'move', token: tokenIndex }, {
      ...gameState.game_state,
      positions: newPositions
    });
    
    setDiceValue(null);
    
    if (newPositions[myColor].every(p => p >= 57)) {
      await endGame(myRole);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-700 via-yellow-600 to-green-700 text-white flex items-center justify-center">
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
        gameLabel="Ludo"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="ludo-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-700 via-yellow-600 to-green-700 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="🎲 Ludo Rules"
        rules={GAME_RULES.ludo}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header with Rules Button */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => { leaveGame(); navigate('/http-multiplayer'); }}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Leave
          </Button>
          <Button
            variant="ghost"
            onClick={() => setShowRules(true)}
            className="text-white hover:bg-white/10 border border-white/30"
          >
            <BookOpen className="w-5 h-5 mr-2" />
            Rules
          </Button>
        </div>

        

        {/* Player Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className={`p-4 ${myRole === 'player1' ? 'bg-red-600/30 border-red-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player1Name}</p>
            <div className="flex gap-1 mt-2">
              {[0,1,2,3].map(i => <LudoToken key={`item-${i}`} color="red" position={positions.red[i]} />)}
            </div>
          </Card>
          <Card className={`p-4 ${myRole === 'player2' ? 'bg-blue-600/30 border-blue-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player2Name}</p>
            <div className="flex gap-1 mt-2">
              {[0,1,2,3].map(i => <LudoToken key={`item-${i}`} color="blue" position={positions.blue[i]} />)}
            </div>
          </Card>
        </div>

        {/* Turn Indicator */}
        {localGameStatus === 'playing' && (
          <Card className={`p-4 mb-6 ${isMyTurn ? 'bg-green-600' : 'bg-gray-700'}`}>
            <p className="text-xl font-black text-center">
              {isMyTurn ? '🎮 YOUR TURN! Roll the dice' : '⏳ Opponent\'s Turn'}
            </p>
          </Card>
        )}

        {/* Dice */}
        <Card className="bg-white/10 p-8 mb-6 text-center">
          <p className="text-sm mb-4">Dice Roll</p>
          {diceValue ? (
            <motion.div initial={{ rotate: 0 }} animate={{ rotate: 360 }} className="text-8xl mx-auto w-32 h-32 bg-white text-black rounded-2xl flex items-center justify-center font-black shadow-2xl">
              {diceValue}
            </motion.div>
          ) : (
            <div className="text-6xl">🎲</div>
          )}
          {isMyTurn && !diceValue && localGameStatus === 'playing' && (
            <Button onClick={handleRollDice} className="mt-4 bg-green-600 hover:bg-green-700 text-xl px-8 py-6">
              <Dices className="w-6 h-6 mr-2" />Roll Dice
            </Button>
          )}
        </Card>

        {/* Piece Selection */}
        {isMyTurn && diceValue && localGameStatus === 'playing' && (
          <Card className="bg-white/10 p-6 mb-6">
            <h3 className="text-lg font-bold mb-4 text-center">Select Piece to Move (+{diceValue})</h3>
            <div className="flex gap-4 justify-center">
              {[0,1,2,3].map(i => (
                <motion.button
                  key={`item-${i}`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleMoveToken(i)}
                  className="relative"
                >
                  <LudoToken color={myColor} position={positions[myColor][i]} />
                  <p className="text-xs mt-1">Piece {i+1}</p>
                </motion.button>
              ))}
            </div>
          </Card>
        )}

        {/* Game Result */}
        <AnimatePresence>
          {localGameStatus !== 'playing' && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
              <Card className={`inline-block px-8 py-6 ${localGameStatus === 'won' ? 'bg-green-600' : 'bg-red-600'}`}>
                <div className="text-6xl mb-4">{localGameStatus === 'won' ? '🏆' : '😢'}</div>
                <h2 className="text-3xl font-black">{localGameStatus === 'won' ? 'YOU WIN!' : 'YOU LOSE!'}</h2>
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
