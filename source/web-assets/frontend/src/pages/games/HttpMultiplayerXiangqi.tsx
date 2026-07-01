
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { ArrowLeft, BookOpen } from 'lucide-react';
import GameRulesModal from '@/components/GameRulesModal';
import { GAME_RULES } from '@/config/gameRules';
import { useGameSounds } from '@/hooks/useGameSounds';

const XiangqiPiece = ({ piece, isRed, onClick }) => {
  const pieceSymbols = {
    general: isRed ? '帥' : '將',
    advisor: isRed ? '仕' : '士',
    elephant: isRed ? '相' : '象',
    horse: isRed ? '傌' : '馬',
    chariot: isRed ? '俥' : '車',
    cannon: isRed ? '炮' : '砲',
    soldier: isRed ? '兵' : '卒'
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.15 }}
      onClick={onClick}
      className={`w-12 h-12 rounded-full border-4 shadow-xl flex items-center justify-center cursor-pointer ${
        isRed 
          ? 'bg-red-100 border-red-700 text-red-900' 
          : 'bg-gray-900 border-black text-white'
      }`}
    >
      <span className="text-xl font-black">{pieceSymbols[piece.type] || '?'}</span>
    </motion.div>
  );
};

export default function HttpMultiplayerXiangqi() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [selectedSquare, setSelectedSquare] = useState(null);
  
  const sounds = useGameSounds();

  const myRole = gameState?.my_role;
  const isRed = myRole === 'player1';
  const board = gameState?.game_state?.board || [];

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
  }, [gameState, myRole, sounds, setLocalGameStatus, setShowConfetti]);

  const handleSquareClick = async (index) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    if (selectedSquare === null) {
      // Select piece
      if (board[index] && board[index].player === myRole) {
        setSelectedSquare(index);
        sounds.playClick();
      }
    } else {
      // Move piece
      sounds.playMove();
      await makeMove({ action: 'move', from: selectedSquare, to: index }, gameState.game_state);
      setSelectedSquare(null);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-900 via-orange-800 to-yellow-700 text-white flex items-center justify-center">
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
        gameLabel="Xiangqi"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="xiangqi-game-over"
      />
    );
  }


  const currentPlayerName = isMyTurn ? 'Your Turn' : `${opponent?.name || 'Opponent'}'s Turn`;

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-900 via-orange-800 to-yellow-700 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="象 Xiangqi Rules"
        rules={GAME_RULES.xiangqi}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => { leaveGame(); navigate('/http-multiplayer'); }}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Leave Game
          </Button>
          
          <div className="text-center">
            <p className="text-sm opacity-80">Chinese Chess</p>
            <p className="text-xs opacity-60">{currentPlayerName}</p>
          </div>

          <div className="bg-black/30 backdrop-blur-xl px-4 py-2 rounded-xl">
            <p className="text-xs">You are</p>
            <p className="text-xl font-bold">{isRed ? '🔴 Red' : '⚫ Black'}</p>
          </div>
        </div>

        {/* Game Status */}
        {localGameStatus !== 'playing' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="text-center mb-6"
          >
            <Card className="bg-black/40 backdrop-blur-xl border-2 border-yellow-400 p-8 inline-block">
              <h2 className="text-5xl font-black mb-2">
                {localGameStatus === 'won' ? '🏆 YOU WON!' : '😢 YOU LOST'}
              </h2>
              <p className="text-lg">Checkmate!</p>
              <Button onClick={() => navigate('/http-multiplayer')} className="mt-4">
                Back to Lobby
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Xiangqi Board (9x10) */}
        <Card className="bg-amber-100 border-4 border-amber-900 p-4 mb-6 max-w-2xl mx-auto">
          <div className="relative">
            {/* River */}
            <div className="absolute top-1/2 left-0 right-0 h-8 bg-blue-200 opacity-30 -translate-y-1/2" />
            
            {/* Board Grid */}
            <div className="grid grid-cols-9 gap-1">
              {Array.from({ length: 90 }).map((_, i) => {
                const piece = board[i];
                const isSelected = selectedSquare === i;
                const row = Math.floor(i / 9);
                const isRiver = row === 4 || row === 5;
                
                return (
                  <div
                    key={`item-${i}`}
                    onClick={() => handleSquareClick(i)}
                    className={`aspect-square border flex items-center justify-center cursor-pointer relative ${
                      isSelected ? 'bg-yellow-300 ring-2 ring-yellow-500' : 'bg-amber-50'
                    } ${
                      isRiver ? 'border-blue-400' : 'border-amber-700'
                    } hover:bg-amber-200`}
                  >
                    {piece && (
                      <XiangqiPiece 
                        piece={piece} 
                        isRed={piece.player === 'player1'} 
                        onClick={() => handleSquareClick(i)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Game Info */}
        <Card className="bg-black/30 backdrop-blur-xl border-white/20 p-4 mb-6">
          <h3 className="text-lg font-bold mb-2">How to Play</h3>
          <ul className="text-sm space-y-1 opacity-80">
            <li>• Click a piece to select it</li>
            <li>• Click a square to move</li>
            <li>• Capture the opponent's General (帥/將) to win</li>
            <li>• Pieces cannot cross the river except soldiers, chariots, cannons, and horses</li>
          </ul>
        </Card>

        {/* Turn Indicator */}
        <div className="mt-6 text-center">
          <div className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-lg ${
            isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-gray-600'
          }`}>
            {isMyTurn ? '🟢 Your Turn' : '⏳ Waiting...'}
          </div>
        </div>
      </div>
    </div>
  );
}