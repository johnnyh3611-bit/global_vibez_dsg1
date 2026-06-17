
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

const MahjongTile = ({ tile, onClick, playable }: { tile: any; onClick?: () => void; playable?: boolean }) => {
  const suitEmojis = {
    bamboo: '🎋',
    character: '🀄',
    dot: '⚪',
    wind: '💨',
    dragon: '🐉'
  };
  
  return (
    <motion.div
      whileHover={playable ? { scale: 1.1, y: -5 } : {}}
      onClick={playable ? onClick : undefined}
      className={`relative w-12 h-16 bg-gradient-to-br from-amber-50 to-amber-100 rounded border-2 border-amber-800 shadow-lg flex flex-col items-center justify-center ${
        playable ? 'cursor-pointer hover:shadow-2xl' : 'opacity-60'
      }`}
    >
      <span className="text-2xl">{suitEmojis[tile.suit] || '🀫'}</span>
      <span className="text-xs font-bold text-amber-900">{tile.value}</span>
    </motion.div>
  );
};

export default function HttpMultiplayerMahjong() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [selectedTile, setSelectedTile] = useState(null);
  
  const sounds = useGameSounds();

  const myRole = gameState?.my_role;
  const myHand = gameState?.game_state?.hands?.[myRole] || [];
  const discardPile = gameState?.game_state?.discard_pile || [];
  const wallRemaining = gameState?.game_state?.wall?.length || 0;

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

  const handleDrawTile = async () => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    sounds.playClick();
    
    await makeMove({ action: 'draw' }, gameState.game_state);
  };

  const handleDiscardTile = async (tileIndex) => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    sounds.playMove();
    
    const newHand = myHand.filter((_, i) => i !== tileIndex);
    const discardedTile = myHand[tileIndex];
    
    await makeMove({ action: 'discard', tileIndex }, {
      ...gameState.game_state,
      hands: { ...gameState.game_state.hands, [myRole]: newHand },
      discard_pile: [...discardPile, discardedTile]
    });
  };

  const handleDeclareWin = async () => {
    if (!isMyTurn) return;
    await endGame(myRole);
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-700 via-red-600 to-yellow-700 text-white flex items-center justify-center">
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
        gameLabel="Mahjong"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="mahjong-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';
  const currentPlayerName = isMyTurn ? 'Your Turn' : `${opponent?.name || 'Opponent'}'s Turn`;

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-amber-700 via-red-600 to-yellow-700 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} />}
      
      {/* Rules Modal */}
      <GameRulesModal
        isOpen={showRules}
        onClose={() => setShowRules(false)}
        title="🀄 Mahjong Rules"
        rules={GAME_RULES.mahjong}
      />
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.1) 35px, rgba(255,255,255,.1) 70px)'
        }} />
      </div>

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

        {/* Discard Pile */}
        <Card className="bg-black/30 backdrop-blur-xl border-white/20 p-4 mb-6">
          <h3 className="text-lg font-bold mb-2">Discard Pile</h3>
          <div className="flex gap-2 flex-wrap">
            {discardPile.slice(-10).map((tile, i) => (
              <MahjongTile key={`item-${i}`} tile={tile} playable={false} />
            ))}
            {discardPile.length === 0 && <p className="text-gray-400">No tiles discarded yet</p>}
          </div>
        </Card>

        {/* Player's Hand */}
        <Card className="bg-black/30 backdrop-blur-xl border-white/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold">Your Hand ({myHand.length} tiles)</h3>
            <Button 
              onClick={handleDrawTile}
              disabled={!isMyTurn || localGameStatus !== 'playing'}
              className="bg-green-600 hover:bg-green-700"
            >
              Draw Tile
            </Button>
          </div>
          
          <div className="flex gap-2 flex-wrap justify-center mb-4">
            {myHand.map((tile, i) => (
              <MahjongTile
                key={`myHand-${i}`}
                tile={tile}
                onClick={() => handleDiscardTile(i)}
                playable={isMyTurn && localGameStatus === 'playing'}
              />
            ))}
          </div>

          {isMyTurn && myHand.length >= 14 && (
            <Button 
              onClick={handleDeclareWin}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold text-lg"
            >
              🏆 Declare Mahjong!
            </Button>
          )}
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