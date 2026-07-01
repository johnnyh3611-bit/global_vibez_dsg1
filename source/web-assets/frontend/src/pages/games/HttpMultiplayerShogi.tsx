
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

const ShogiPiece = ({ piece, onClick, isPromoted }: { piece: any; onClick?: () => void; isPromoted?: boolean }) => {
  const pieceSymbols = {
    king: '王',
    rook: '飛',
    bishop: '角',
    gold: '金',
    silver: '銀',
    knight: '桂',
    lance: '香',
    pawn: '歩'
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.1 }}
      onClick={onClick}
      className={`w-12 h-14 bg-gradient-to-br from-amber-200 to-amber-300 border-2 border-amber-800 rounded shadow-lg flex items-center justify-center cursor-pointer relative ${
        isPromoted ? 'border-red-600' : ''
      }`}
    >
      <span className="text-2xl font-bold text-amber-900">{pieceSymbols[piece.type] || '?'}</span>
      {isPromoted && <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />}
    </motion.div>
  );
};

export default function HttpMultiplayerShogi() {
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
  const board = gameState?.game_state?.board || [];
  const captures = gameState?.game_state?.captures || { player1: [], player2: [] };

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

  const handleSquareClick = async (index) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    if (selectedSquare === null) {
      setSelectedSquare(index);
      sounds.playClick();
    } else {
      sounds.playMove();
      await makeMove({ action: 'move', from: selectedSquare, to: index }, gameState.game_state);
      setSelectedSquare(null);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-800 via-orange-700 to-yellow-600 text-white flex items-center justify-center">
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
        gameLabel="Shogi"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="shogi-game-over"
      />
    );
  }


  const currentPlayerName = isMyTurn ? 'Your Turn' : `${opponent?.name || 'Opponent'}'s Turn`;

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-800 via-orange-700 to-yellow-600 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="将 Shogi Rules"
        rules={GAME_RULES.shogi}
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
            <p className="text-sm opacity-80">{currentPlayerName}</p>
          </div>

          <div className="bg-black/30 backdrop-blur-xl px-4 py-2 rounded-xl">
            <p className="text-xs">Captured</p>
            <p className="text-xl font-bold">{captures[myRole]?.length || 0}</p>
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
              <Button onClick={() => navigate('/http-multiplayer')} className="mt-4">
                Back to Lobby
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Shogi Board (9x9) */}
        <Card className="bg-amber-100 border-4 border-amber-900 p-4 mb-6 max-w-2xl mx-auto">
          <div className="grid grid-cols-9 gap-1">
            {Array.from({ length: 81 }).map((_, i) => {
              const piece = board[i];
              const isSelected = selectedSquare === i;
              
              return (
                <div
                  key={`item-${i}`}
                  onClick={() => handleSquareClick(i)}
                  className={`aspect-square border border-amber-700 flex items-center justify-center ${
                    isSelected ? 'bg-yellow-300 ring-2 ring-yellow-500' : 'bg-amber-50'
                  } cursor-pointer hover:bg-amber-200`}
                >
                  {piece && <ShogiPiece piece={piece} isPromoted={piece.promoted} />}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Captured Pieces */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-black/30 backdrop-blur-xl border-white/20 p-4">
            <h3 className="text-sm font-bold mb-2">Your Captures</h3>
            <div className="flex gap-2 flex-wrap">
              {captures[myRole]?.map((piece, i) => (
                <div key={`item-${i}`} className="text-2xl">{piece.symbol}</div>
              )) || <p className="text-xs text-gray-400">None</p>}
            </div>
          </Card>
          <Card className="bg-black/30 backdrop-blur-xl border-white/20 p-4">
            <h3 className="text-sm font-bold mb-2">Opponent's Captures</h3>
            <div className="flex gap-2 flex-wrap">
              {captures[myRole === 'player1' ? 'player2' : 'player1']?.map((piece, i) => (
                <div key={`item-${i}`} className="text-2xl">{piece.symbol}</div>
              )) || <p className="text-xs text-gray-400">None</p>}
            </div>
          </Card>
        </div>

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