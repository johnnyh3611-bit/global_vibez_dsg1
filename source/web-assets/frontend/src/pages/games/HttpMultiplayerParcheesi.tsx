
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

const ParcheesiToken = ({ color, onClick, playable }: { color: string; onClick?: () => void; playable?: boolean }) => (
  <motion.div
    whileHover={playable ? { scale: 1.2 } : {}}
    onClick={playable ? onClick : undefined}
    className={`w-10 h-10 rounded-full ${
      color === 'red' ? 'bg-red-600' :
      color === 'blue' ? 'bg-blue-600' :
      color === 'green' ? 'bg-green-600' :
      color === 'yellow' ? 'bg-yellow-500' : 'bg-gray-400'
    } border-4 border-white shadow-xl ${
      playable ? 'cursor-pointer animate-pulse' : ''
    }`}
  />
);

const Dice = ({ value }) => (
  <div className="w-16 h-16 bg-white rounded-xl border-4 border-gray-800 flex items-center justify-center shadow-xl">
    <span className="text-4xl font-black">{value}</span>
  </div>
);

export default function HttpMultiplayerParcheesi() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [diceValue, setDiceValue] = useState(null);
  
  const sounds = useGameSounds();

  const myRole = gameState?.my_role;
  const myColor = myRole === 'player1' ? 'red' : 'blue';
  const positions = gameState?.game_state?.positions || { red: [0, 0, 0, 0], blue: [0, 0, 0, 0] };

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
    
    sounds.playDiceRoll();
    
    const roll = Math.floor(Math.random() * 6) + 1;
    setDiceValue(roll);
    
    await makeMove({ action: 'roll', value: roll }, gameState.game_state);
  };

  const handleMoveToken = async (tokenIndex) => {
    if (!isMyTurn || !diceValue) return;
    
    sounds.playMove();
    
    const newPositions = { ...positions };
    newPositions[myColor][tokenIndex] += diceValue;
    
    // Capture opponent token if landing on same space
    Object.keys(newPositions).forEach(color => {
      if (color !== myColor) {
        newPositions[color] = newPositions[color].map(pos => 
          pos === newPositions[myColor][tokenIndex] ? 0 : pos
        );
      }
    });
    
    await makeMove({ action: 'move', token: tokenIndex }, {
      ...gameState.game_state,
      positions: newPositions
    });
    
    setDiceValue(null);
    
    // Check win condition (all tokens at position 68)
    if (newPositions[myColor].every(p => p >= 68)) {
      await endGame(myRole);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-700 via-blue-700 to-green-700 text-white flex items-center justify-center">
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
        gameLabel="Parcheesi"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="parcheesi-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-red-700 via-blue-700 to-green-700 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="🎲 Parcheesi Rules"
        rules={GAME_RULES.parcheesi}
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
            {diceValue && <Dice value={diceValue} />}
          </div>
        </Card>

        {/* Board */}
        <div className="bg-gradient-to-br from-white/20 to-white/10 backdrop-blur-md rounded-3xl p-8 shadow-2xl mb-6">
          {/* Cross-shaped board layout */}
          <div className="relative w-full h-96">
            {/* Track visualization (simplified) */}
            <div className="grid grid-cols-8 gap-2 h-full">
              {Array.from({ length: 68 }).map((_, i) => {
                const hasRed = positions.red.includes(i);
                const hasBlue = positions.blue.includes(i);
                
                return (
                  <div
                    key={`item-${i}`}
                    className={`flex items-center justify-center ${
                      i % 17 === 0 ? 'bg-yellow-500/30' : 'bg-white/20'
                    } rounded-lg border-2 border-white/30`}
                  >
                    {hasRed && positions.red.map((pos, idx) => 
                      pos === i && <ParcheesiToken key={`red-${idx}`} color="red" />
                    )}
                    {hasBlue && positions.blue.map((pos, idx) => 
                      pos === i && <ParcheesiToken key={`blue-${idx}`} color="blue" />
                    )}
                    <span className="text-xs text-white/50">{i}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Player's Pieces */}
        <Card className="bg-white/20 backdrop-blur-md p-6 mb-4">
          <h3 className="text-xl font-bold mb-4">Your Pieces</h3>
          <div className="flex gap-6 justify-center">
            {positions[myColor]?.map((pos, i) => (
              <div key={`item-${i}`} className="text-center">
                <ParcheesiToken
                  color={myColor}
                  playable={isMyTurn && diceValue !== null}
                  onClick={() => handleMoveToken(i)}
                />
                <p className="text-sm mt-2">Position: {pos}/68</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Dice Roll */}
        {isMyTurn && !diceValue && localGameStatus === 'playing' && (
          <div className="text-center">
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
