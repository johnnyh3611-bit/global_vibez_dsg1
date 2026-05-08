
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
import GameRulesModal from '@/components/GameRulesModal';
import { GAME_RULES } from '@/config/gameRules';
import { useGameSounds } from '@/hooks/useGameSounds';

const Marble = ({ color, onClick, playable, selected }) => (
  <motion.div
    whileHover={playable ? { scale: 1.2 } : {}}
    onClick={playable ? onClick : undefined}
    className={`w-8 h-8 rounded-full ${
      color === 'red' ? 'bg-red-500' :
      color === 'blue' ? 'bg-blue-500' :
      color === 'green' ? 'bg-green-500' :
      color === 'yellow' ? 'bg-yellow-500' :
      color === 'purple' ? 'bg-purple-500' :
      color === 'orange' ? 'bg-orange-500' : 'bg-gray-300'
    } border-4 ${selected ? 'border-white' : 'border-gray-800'} shadow-xl ${
      playable ? 'cursor-pointer animate-pulse' : ''
    }`}
  />
);

export default function HttpMultiplayerChineseCheckers() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [selectedMarble, setSelectedMarble] = useState(null);
  
  const sounds = useGameSounds();

  const myRole = gameState?.my_role;
  const myColor = myRole === 'player1' ? 'red' : 'blue';
  const board = gameState?.game_state?.board || {};

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

  const handleMarbleClick = async (position) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    if (!selectedMarble) {
      // Select marble
      if (board[position] === myColor) {
        setSelectedMarble(position);
        sounds.playClick();
      }
    } else {
      // Move marble
      if (!board[position]) {
        sounds.playMove();
        
        const newBoard = { ...board };
        delete newBoard[selectedMarble];
        newBoard[position] = myColor;
        
        await makeMove({ action: 'move', from: selectedMarble, to: position }, {
          ...gameState.game_state,
          board: newBoard
        });
        
        setSelectedMarble(null);
      }
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white flex items-center justify-center">
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
        gameLabel="Chinese Checkers"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="chinesecheckers-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  // Star board positions (simplified - 121 positions for 11x11 grid)
  const renderBoard = () => {
    const positions = [];
    for (let row = 0; row < 17; row++) {
      for (let col = 0; col < 17; col++) {
        const pos = `${row}-${col}`;
        const hasMarble = board[pos];
        const isPlayable = isMyTurn && (!selectedMarble || !hasMarble);
        
        positions.push(
          <div key={pos} className="flex items-center justify-center">
            {hasMarble ? (
              <Marble
                color={hasMarble}
                onClick={() => handleMarbleClick(pos)}
                playable={isPlayable && hasMarble === myColor}
                selected={selectedMarble === pos}
              />
            ) : (
              <div
                onClick={() => selectedMarble && handleMarbleClick(pos)}
                className={`w-6 h-6 rounded-full bg-gray-700/50 ${
                  selectedMarble ? 'cursor-pointer hover:bg-gray-600' : ''
                }`}
              />
            )}
          </div>
        );
      }
    }
    return positions;
  };

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="⭐ Chinese Checkers Rules"
        rules={GAME_RULES.chinesecheckers}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        

        {/* Game Status */}
        <Card className="bg-white/10 backdrop-blur-md p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-bold">{player1Name} (🔴)</p>
              <p className="font-bold">{player2Name} (🔵)</p>
            </div>
            <div className={`px-6 py-3 rounded-lg ${isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}>
              {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}
            </div>
          </div>
        </Card>

        {/* Board */}
        <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
          <div className="grid grid-cols-17 gap-2 max-w-3xl mx-auto">
            {renderBoard()}
          </div>
        </div>

        {selectedMarble && (
          <div className="text-center mt-4">
            <p className="text-xl">Click empty space to move marble</p>
            <Button onClick={() => setSelectedMarble(null)} variant="outline" className="mt-2">
              Cancel Selection
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
