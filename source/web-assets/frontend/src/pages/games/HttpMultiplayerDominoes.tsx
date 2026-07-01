
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import GameRulesModal from '@/components/GameRulesModal';
import { GAME_RULES } from '@/config/gameRules';
import { useGameSounds } from '@/hooks/useGameSounds';

const Domino = ({ top, bottom, onClick, playable }: { top: any; bottom: any; onClick?: () => void; playable?: boolean }) => (
  <motion.div
    whileHover={playable ? { scale: 1.1 } : {}}
    onClick={playable ? onClick : undefined}
    className={`relative w-16 h-32 bg-gradient-to-br from-white to-gray-100 rounded-lg border-4 border-gray-800 shadow-xl ${
      playable ? 'cursor-pointer hover:shadow-2xl' : 'opacity-60'
    }`}
  >
    <div className="absolute top-0 left-0 right-0 h-1/2 flex items-center justify-center border-b-2 border-gray-800">
      <span className="text-3xl font-black">{top === 0 ? '⚫' : '•'.repeat(top)}</span>
    </div>
    <div className="absolute bottom-0 left-0 right-0 h-1/2 flex items-center justify-center">
      <span className="text-3xl font-black">{bottom === 0 ? '⚫' : '•'.repeat(bottom)}</span>
    </div>
  </motion.div>
);

export default function HttpMultiplayerDominoes() {
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
  const myHand = gameState?.game_state?.hands?.[myRole] || [];
  const playedDominoes = gameState?.game_state?.played || [];
  const leftEnd = playedDominoes.length > 0 ? playedDominoes[0] : null;
  const rightEnd = playedDominoes.length > 0 ? playedDominoes[playedDominoes.length - 1] : null;

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

  const handlePlayDomino = async (dominoIndex, side) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    sounds.playMove();
    
    const domino = myHand[dominoIndex];
    const newHand = myHand.filter((_, i) => i !== dominoIndex);
    const newPlayed = side === 'left' ? [domino, ...playedDominoes] : [...playedDominoes, domino];
    
    await makeMove({ action: 'play', dominoIndex, side }, {
      ...gameState.game_state,
      hands: { ...gameState.game_state.hands, [myRole]: newHand },
      played: newPlayed
    });
    
    if (newHand.length === 0) {
      await endGame(myRole);
    }
  };

  const handleDrawDomino = async () => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    const newDomino = { top: Math.floor(Math.random() * 7), bottom: Math.floor(Math.random() * 7) };
    const newHand = [...myHand, newDomino];
    
    await makeMove({ action: 'draw' }, {
      ...gameState.game_state,
      hands: { ...gameState.game_state.hands, [myRole]: newHand }
    });
  };

  const canPlay = (domino) => {
    if (playedDominoes.length === 0) return true;
    const leftValue = leftEnd?.top || 0;
    const rightValue = rightEnd?.bottom || 0;
    return domino.top === leftValue || domino.bottom === leftValue || 
           domino.top === rightValue || domino.bottom === rightValue;
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-700 via-yellow-600 to-orange-700 text-white flex items-center justify-center">
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
        gameLabel="Dominoes"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="dominoes-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-700 via-yellow-600 to-orange-700 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="🀫 Dominoes Rules"
        rules={GAME_RULES.dominoes}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header with Rules Button */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => { leaveGame(); navigate('/http-multiplayer'); }}
            className="text-white hover:bg-white/10"
          >
            ← Leave
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
              <p className="text-sm">{player1Name}: {gameState.game_state?.hands?.player1?.length || 0} dominoes</p>
              <p className="text-sm">{player2Name}: {gameState.game_state?.hands?.player2?.length || 0} dominoes</p>
            </div>
            <div className={`px-6 py-3 rounded-lg ${isMyTurn ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}>
              {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}
            </div>
          </div>
        </Card>

        {/* Played Dominoes */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 justify-center min-w-max p-4">
            {playedDominoes.length === 0 ? (
              <div className="text-center text-xl">Play first domino!</div>
            ) : (
              playedDominoes.map((domino, i) => (
                <Domino key={`playedDominoes-${i}`} top={domino.top} bottom={domino.bottom} playable={false} />
              ))
            )}
          </div>
        </div>

        {/* Player's Hand */}
        {localGameStatus === 'playing' && (
          <Card className="bg-white/20 backdrop-blur-md p-6">
            <h3 className="text-xl font-bold mb-4">Your Dominoes</h3>
            <div className="flex flex-wrap gap-4 justify-center">
              {myHand.map((domino, i) => (
                <Domino 
                  key={`myHand-${i}`} 
                  top={domino.top} 
                  bottom={domino.bottom}
                  playable={isMyTurn && canPlay(domino)}
                  onClick={() => handlePlayDomino(i, 'right')}
                />
              ))}
            </div>
            {isMyTurn && (
              <div className="text-center mt-4">
                <Button onClick={handleDrawDomino} variant="secondary">
                  Draw Domino
                </Button>
              </div>
            )}
          </Card>
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
