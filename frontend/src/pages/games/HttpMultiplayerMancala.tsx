
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

const MancalaPit = ({ seeds, onClick, isStore, isActive, label }: { seeds?: any; onClick?: any; isStore?: any; isActive?: any; label?: any }) => (
  <motion.div
    whileHover={isActive ? { scale: 1.05 } : {}}
    onClick={isActive ? onClick : undefined}
    className={`relative ${isStore ? 'h-40 w-20' : 'h-20 w-20'} rounded-${isStore ? 'xl' : 'full'} 
      ${isActive ? 'bg-gradient-to-br from-amber-600 to-yellow-700 cursor-pointer' : 'bg-gradient-to-br from-amber-800 to-yellow-900'}
      border-4 border-amber-950 shadow-xl flex items-center justify-center
      ${isActive ? 'animate-pulse' : ''}`}
  >
    <div className="text-center">
      <div className="text-3xl font-black text-white">{seeds}</div>
      {label && <div className="text-xs text-amber-200">{label}</div>}
    </div>
  </motion.div>
);

export default function HttpMultiplayerMancala() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [showRules, setShowRules] = useState(false);
  
  const sounds = useGameSounds();

  const myRole = gameState?.my_role;
  const board = gameState?.game_state?.board || Array(14).fill(4); // 6 pits + store per player, 4 seeds each
  const player1Store = board[6];
  const player2Store = board[13];

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

  const handleMove = async (pitIndex) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    sounds.playMove();
    
    const newBoard = [...board];
    let seeds = newBoard[pitIndex];
    newBoard[pitIndex] = 0;
    
    let currentPit = pitIndex;
    while (seeds > 0) {
      currentPit = (currentPit + 1) % 14;
      // Skip opponent's store
      if ((myRole === 'player1' && currentPit === 13) || (myRole === 'player2' && currentPit === 6)) {
        continue;
      }
      newBoard[currentPit]++;
      seeds--;
    }
    
    await makeMove({ action: 'sow', pitIndex }, {
      ...gameState.game_state,
      board: newBoard
    });
    
    // Check if game over (all pits on one side empty)
    const p1Side = newBoard.slice(0, 6).every(p => p === 0);
    const p2Side = newBoard.slice(7, 13).every(p => p === 0);
    if (p1Side || p2Side) {
      const winner = newBoard[6] > newBoard[13] ? 'player1' : 'player2';
      await endGame(winner);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900 text-white flex items-center justify-center">
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
        gameLabel="Mancala"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="mancala-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';
  const myPits = myRole === 'player1' ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12];
  const opponentPits = myRole === 'player1' ? [12, 11, 10, 9, 8, 7] : [5, 4, 3, 2, 1, 0];

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="🪨 Mancala Rules"
        rules={GAME_RULES.mancala}
      />

      <div className="max-w-5xl mx-auto relative z-10">
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
        <Card className="bg-white/10 backdrop-blur-md p-4 mb-6">
          <div className={`text-center px-6 py-3 rounded-lg ${isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}>
            {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}
          </div>
        </Card>

        {/* Mancala Board */}
        <div className="bg-gradient-to-br from-amber-800/50 to-yellow-900/50 backdrop-blur-md rounded-3xl p-8 shadow-2xl">
          {/* Opponent's Side */}
          <div className="text-center mb-4">
            <p className="font-bold text-xl">{myRole === 'player1' ? player2Name : player1Name}</p>
          </div>
          
          <div className="flex items-center justify-between gap-4 mb-8">
            {/* Opponent's Store */}
            <MancalaPit 
              seeds={myRole === 'player1' ? player2Store : player1Store} 
              isStore={true}
              label="Store"
            />
            
            {/* Opponent's Pits */}
            <div className="flex gap-4">
              {opponentPits.map((pitIndex) => (
                <MancalaPit 
                  key={pitIndex}
                  seeds={board[pitIndex]}
                  isActive={false}
                />
              ))}
            </div>
            
            <div className="w-20"></div>
          </div>

          {/* Player's Side */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="w-20"></div>
            
            {/* Player's Pits */}
            <div className="flex gap-4">
              {myPits.map((pitIndex) => (
                <MancalaPit 
                  key={pitIndex}
                  seeds={board[pitIndex]}
                  onClick={() => handleMove(pitIndex)}
                  isActive={isMyTurn && board[pitIndex] > 0 && localGameStatus === 'playing'}
                />
              ))}
            </div>
            
            {/* Player's Store */}
            <MancalaPit 
              seeds={myRole === 'player1' ? player1Store : player2Store} 
              isStore={true}
              label="Your Store"
            />
          </div>
          
          <div className="text-center mt-4">
            <p className="font-bold text-xl">{myRole === 'player1' ? player1Name : player2Name}</p>
          </div>
        </div>

        {/* Game Over */}
        {localGameStatus !== 'playing' && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className={`fixed inset-0 flex items-center justify-center bg-black/80 z-50`}>
            <Card className={`p-8 text-center ${localGameStatus === 'won' ? 'bg-green-600' : 'bg-red-600'}`}>
              <h2 className="text-4xl font-black mb-4">
                {localGameStatus === 'won' ? '🎉 YOU WIN! 🎉' : '😔 YOU LOSE'}
              </h2>
              <p className="mb-4">
                Your Store: {myRole === 'player1' ? player1Store : player2Store} seeds<br/>
                Opponent: {myRole === 'player1' ? player2Store : player1Store} seeds
              </p>
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
