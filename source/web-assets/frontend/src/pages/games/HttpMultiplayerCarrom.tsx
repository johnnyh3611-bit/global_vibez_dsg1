
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
import { ArrowLeft, Target } from 'lucide-react';
import GameRulesModal from '@/components/GameRulesModal';
import { GAME_RULES } from '@/config/gameRules';
import { useGameSounds } from '@/hooks/useGameSounds';

const CarromPiece = ({ color, position, onClick }) => {
  const colors = {
    white: 'bg-white border-gray-400',
    black: 'bg-gray-900 border-black',
    red: 'bg-red-600 border-red-800'
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.2 }}
      onClick={onClick}
      className={`w-8 h-8 rounded-full ${colors[color]} border-2 shadow-xl cursor-pointer`}
      style={{
        position: 'absolute',
        left: `${position.x}%`,
        top: `${position.y}%`
      }}
    />
  );
};

export default function HttpMultiplayerCarrom() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [power, setPower] = useState(0);
  
  const sounds = useGameSounds();

  const myRole = gameState?.my_role;
  const myColor = myRole === 'player1' ? 'white' : 'black';
  const pieces = gameState?.game_state?.pieces || [];
  const myScore = gameState?.game_state?.scores?.[myRole] || 0;
  const opponentScore = gameState?.game_state?.scores?.[myRole === 'player1' ? 'player2' : 'player1'] || 0;

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

  const handleStrike = async () => {
    if (!isMyTurn || !selectedPiece || localGameStatus !== 'playing') return;
    
    sounds.playMove();
    
    await makeMove({ action: 'strike', piece: selectedPiece, power }, gameState.game_state);
    setSelectedPiece(null);
    setPower(0);
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-600 via-yellow-500 to-orange-600 text-white flex items-center justify-center">
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
        gameLabel="Carrom"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="carrom-game-over"
      />
    );
  }


  const currentPlayerName = isMyTurn ? 'Your Turn' : `${opponent?.name || 'Opponent'}'s Turn`;

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-600 via-yellow-500 to-orange-600 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="🎯 Carrom Rules"
        rules={GAME_RULES.carrom}
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

          <div className="flex gap-4">
            <div className="bg-black/30 backdrop-blur-xl px-4 py-2 rounded-xl text-center">
              <p className="text-xs">You</p>
              <p className="text-2xl font-bold">{myScore}</p>
            </div>
            <div className="bg-black/30 backdrop-blur-xl px-4 py-2 rounded-xl text-center">
              <p className="text-xs">Opponent</p>
              <p className="text-2xl font-bold">{opponentScore}</p>
            </div>
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
              <p className="text-xl mb-4">Final Score: {myScore} - {opponentScore}</p>
              <Button onClick={() => navigate('/http-multiplayer')} className="mt-4">
                Back to Lobby
              </Button>
            </Card>
          </motion.div>
        )}

        {/* Carrom Board */}
        <Card className="bg-amber-100 border-8 border-amber-900 p-8 mb-6 aspect-square max-w-2xl mx-auto relative">
          {/* Corner Pockets */}
          <div className="absolute top-2 left-2 w-12 h-12 rounded-full bg-black" />
          <div className="absolute top-2 right-2 w-12 h-12 rounded-full bg-black" />
          <div className="absolute bottom-2 left-2 w-12 h-12 rounded-full bg-black" />
          <div className="absolute bottom-2 right-2 w-12 h-12 rounded-full bg-black" />
          
          {/* Center Circle */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 border-4 border-gray-700 rounded-full" />
          
          {/* Pieces */}
          {pieces.map((piece, i) => (
            <CarromPiece
              key={`pieces-${i}`}
              color={piece.color}
              position={piece.position}
              onClick={() => setSelectedPiece(i)}
            />
          ))}
        </Card>

        {/* Controls */}
        {isMyTurn && localGameStatus === 'playing' && (
          <Card className="bg-black/30 backdrop-blur-xl border-white/20 p-6">
            <div className="text-center mb-4">
              <p className="text-lg mb-2">Selected: {selectedPiece !== null ? `Piece ${selectedPiece}` : 'None'}</p>
              <div className="mb-4">
                <label className="text-sm">Strike Power: {power}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={power}
                  onChange={(e) => setPower(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <Button
                onClick={handleStrike}
                disabled={selectedPiece === null}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3"
              >
                <Target className="w-5 h-5 mr-2" />
                Strike!
              </Button>
            </div>
          </Card>
        )}

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