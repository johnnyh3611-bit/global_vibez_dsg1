
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, BookOpen } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import GameRulesModal from '@/components/GameRulesModal';
import { GAME_RULES } from '@/config/gameRules';
import { useGameSounds } from '@/hooks/useGameSounds';

const BackgammonChecker = ({ color, count, onClick, playable }) => (
  <motion.div
    whileHover={playable ? { scale: 1.1 } : {}}
    onClick={playable ? onClick : undefined}
    className={`relative flex flex-col items-center ${playable ? 'cursor-pointer' : ''}`}
  >
    {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
      <div
        key={`item-${i}`}
        className={`w-10 h-10 rounded-full ${
          color === 'white' ? 'bg-gray-100 border-gray-800' : 'bg-gray-900 border-gray-100'
        } border-4 shadow-lg ${i > 0 ? '-mt-6' : ''}`}
      />
    ))}
    {count > 5 && (
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white font-bold text-xl">
        {count}
      </div>
    )}
  </motion.div>
);

const Dice = ({ value }) => (
  <div className="w-12 h-12 bg-white rounded-lg border-4 border-gray-800 flex items-center justify-center shadow-xl">
    <span className="text-3xl font-black">{value}</span>
  </div>
);

export default function HttpMultiplayerBackgammon() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [diceRolled, setDiceRolled] = useState(false);
  const [dice, setDice] = useState([0, 0]);
  const [showRules, setShowRules] = useState(false);
  
  const sounds = useGameSounds();

  const myRole = gameState?.my_role;
  const myColor = myRole === 'player1' ? 'white' : 'black';
  const board = gameState?.game_state?.board || Array(24).fill({ white: 0, black: 0 });

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
    if (!isMyTurn || diceRolled) return;
    
    sounds.playDiceRoll();
    
    const roll = [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
    setDice(roll);
    setDiceRolled(true);
    
    await makeMove({ action: 'roll', dice: roll }, gameState.game_state);
  };

  const handleMove = async (fromPoint, toPoint) => {
    if (!isMyTurn || !diceRolled) return;
    
    const distance = Math.abs(toPoint - fromPoint);
    if (!dice.includes(distance)) return;
    
    sounds.playMove();
    
    const newBoard = [...board];
    newBoard[fromPoint][myColor]--;
    newBoard[toPoint][myColor]++;
    
    await makeMove({ action: 'move', from: fromPoint, to: toPoint }, {
      ...gameState.game_state,
      board: newBoard
    });
    
    setDiceRolled(false);
    setDice([0, 0]);
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-900 via-red-900 to-orange-900 text-white flex items-center justify-center">
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
        gameLabel="Backgammon"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="backgammon-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-900 via-red-900 to-orange-900 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="🎲 Backgammon Rules"
        rules={GAME_RULES.backgammon}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header with Rules */}
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

        

        {/* Game Status */}
        <Card className="bg-white/10 backdrop-blur-md p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold">{player1Name} (⚪)</p>
              <p className="font-bold">{player2Name} (⚫)</p>
            </div>
            <div className={`px-6 py-3 rounded-lg ${isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}>
              {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}
            </div>
            <div className="flex gap-2">
              {dice[0] > 0 && <Dice value={dice[0]} />}
              {dice[1] > 0 && <Dice value={dice[1]} />}
            </div>
          </div>
        </Card>

        {/* Backgammon Board */}
        <div className="bg-gradient-to-r from-amber-800 to-yellow-900 rounded-2xl p-8 shadow-2xl">
          <div className="grid grid-cols-12 gap-2">
            {/* Top Half */}
            <div className="col-span-12 grid grid-cols-12 gap-2 mb-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={`item-${i}`}
                  className={`h-32 ${i % 2 === 0 ? 'bg-red-800' : 'bg-gray-800'} rounded-t-lg flex flex-col items-center justify-start pt-2`}
                >
                  {board[i]?.white > 0 && (
                    <BackgammonChecker 
                      color="white" 
                      count={board[i].white}
                      playable={isMyTurn && myColor === 'white'}
                      onClick={() => handleMove(i, i + dice[0])}
                    />
                  )}
                  {board[i]?.black > 0 && (
                    <BackgammonChecker 
                      color="black" 
                      count={board[i].black}
                      playable={isMyTurn && myColor === 'black'}
                      onClick={() => handleMove(i, i + dice[0])}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Half */}
            <div className="col-span-12 grid grid-cols-12 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i + 12}
                  className={`h-32 ${i % 2 === 0 ? 'bg-gray-800' : 'bg-red-800'} rounded-b-lg flex flex-col items-center justify-end pb-2`}
                >
                  {board[i + 12]?.white > 0 && (
                    <BackgammonChecker 
                      color="white" 
                      count={board[i + 12].white}
                      playable={isMyTurn && myColor === 'white'}
                      onClick={() => handleMove(i + 12, i + 12 - dice[0])}
                    />
                  )}
                  {board[i + 12]?.black > 0 && (
                    <BackgammonChecker 
                      color="black" 
                      count={board[i + 12].black}
                      playable={isMyTurn && myColor === 'black'}
                      onClick={() => handleMove(i + 12, i + 12 - dice[0])}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {isMyTurn && !diceRolled && localGameStatus === 'playing' && (
          <div className="text-center mt-6">
            <Button onClick={handleRollDice} size="lg" className="bg-yellow-500 hover:bg-yellow-600">
              🎲 Roll Dice
            </Button>
          </div>
        )}

        {/* Game Over */}
        {localGameStatus !== 'playing' && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className={`fixed inset-0 flex items-center justify-center bg-black/80 z-50`}>
            <Card className={`p-8 text-center ${localGameStatus === 'won' ? 'bg-green-600' : 'bg-red-600'}`}>
              <h2 className="text-4xl font-black mb-4">
                {localGameStatus === 'won' ? '🎉 YOU WIN! 🎉' : '😔 YOU LOSE'}
              </h2>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => navigate('/http-multiplayer')}>Back to Lobby</Button>
                <Button onClick={() => window.location.reload()} variant="secondary">Play Again</Button>
              </div>
            </Card>
          </motion.div>
        )}

        <div className="text-center mt-6">
          <Button onClick={() => navigate('/http-multiplayer')} variant="outline">
            ← Back to Lobby
          </Button>
        </div>
      </div>
    </div>
  );
}
