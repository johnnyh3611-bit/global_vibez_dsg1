
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import TurnIndicator from '@/components/games/TurnIndicator';

const PlayingCard = ({ card, onClick, disabled, isPlayed }: { card: any; onClick?: () => void; disabled?: boolean; isPlayed?: boolean }) => {
  if (!card) return null;
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);

  const displayRank = {
    '1': 'A',
    '11': 'J',
    '12': 'Q',
    '13': 'K'
  }[rank] || rank;

  const suitSymbol = { H: '♥️', D: '♦️', C: '♣️', S: '♠️' }[suit];
  const isRed = suit === 'H' || suit === 'D';

  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.1, y: -10 } : {}}
      onClick={onClick}
      className={`w-14 h-20 bg-white rounded border-2 flex flex-col items-center justify-center ${
        isRed ? 'text-red-600' : 'text-black'
      } ${disabled ? 'opacity-50' : 'cursor-pointer hover:shadow-xl'} ${isPlayed ? 'opacity-30' : ''}`}
    >
      <div className="text-sm font-bold">{displayRank}</div>
      <div className="text-2xl">{suitSymbol}</div>
    </motion.div>
  );
};

export default function HttpMultiplayerHearts() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();

  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, makeMove, endGame, leaveGame } = useHttpMultiplayer(userId, userName, urlGameId);

  const myRole = gameState?.my_role;
  const myHand = gameState?.game_state?.[`${myRole}_hand`] || [];
  const currentTrick = gameState?.game_state?.current_trick || [];
  const myScore = gameState?.game_state?.[`${myRole}_score`] || 0;
  const opponentRole = myRole === 'player1' ? 'player2' : 'player1';
  const opponentScore = gameState?.game_state?.[`${opponentRole}_score`] || 0;
  const trickCount = gameState?.game_state?.trick_count || 0;
  const isCompleted = gameState?.status === 'completed';
  // Hearts: lower score wins
  const computedWinner = myScore <= opponentScore ? myRole : opponentRole;
  const winnerRole = gameState?.winner || computedWinner;

  const handleCardPlay = async (card) => {
    if (!isMyTurn || isCompleted) return;

    const newHand = myHand.filter(c => c !== card);
    const newTrick = [...currentTrick, { player: myRole, card }];

    cardSoundManager.playCardSlam?.();
    await makeMove({ card }, {
      ...gameState.game_state,
      [`${myRole}_hand`]: newHand,
      current_trick: newTrick
    });

    // Check if round ends
    if (newHand.length === 0) {
      const winner = myScore <= opponentScore ? myRole : opponentRole;
      await endGame(winner);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-rose-900 via-pink-900 to-red-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div> {/* audit:allow-animate */}
          <h2 className="text-2xl font-bold mb-4">Loading game...</h2>
          <Button data-testid="mp-hearts-back-to-lobby" onClick={() => navigate('/http-multiplayer')}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const iWon = winnerRole === myRole;
    return (
      <WinCelebration
        won={iWon}
        gameId={gameId}
        userId={userId}
        gameLabel="Hearts"
        subtitle={`Final Score: ${myScore} vs ${opponentScore}`}
        winnerRole={winnerRole as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="hearts-game-over"
      />
    );
  }

  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-rose-900 via-pink-900 to-red-900 text-white p-4 relative overflow-hidden" data-testid="hearts-game">
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Universal turn indicator (LOCKED 2026-02-16 — every multiplayer room) */}
        {!isCompleted && (
          <TurnIndicator
            role={isMyTurn ? 'me' : 'opponent'}
            name={isMyTurn ? undefined : (opponent?.name || player2Name)}
          />
        )}

        {/* Score Board */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className={`p-4 ${myRole === 'player1' ? 'bg-rose-600/30 border-rose-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player1Name}</p>
            <p className="text-3xl font-black text-rose-400">{myRole === 'player1' ? myScore : opponentScore}</p>
            <p className="text-xs text-gray-300">points (lower is better)</p>
          </Card>
          <Card className={`p-4 ${myRole === 'player2' ? 'bg-rose-600/30 border-rose-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player2Name}</p>
            <p className="text-3xl font-black text-rose-400">{myRole === 'player2' ? myScore : opponentScore}</p>
            <p className="text-xs text-gray-300">points (lower is better)</p>
          </Card>
        </div>

        {/* Turn Indicator */}
        <Card className={`p-4 mb-6 ${isMyTurn ? 'bg-green-600' : 'bg-gray-700'}`}>
          <p className="text-xl font-black text-center">
            {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}
          </p>
        </Card>

        {/* Current Trick */}
        <Card className="bg-white/10 p-6 mb-6">
          <p className="text-sm mb-4 text-center">Current Trick (#{trickCount + 1})</p>
          <div className="flex gap-4 justify-center">
            {currentTrick.length > 0 ? currentTrick.map((play, i) => (
              <div key={`currentTrick-${i}`} className="text-center">
                <PlayingCard card={play.card} disabled />
                <p className="text-xs mt-2">{play.player === myRole ? 'You' : 'Opponent'}</p>
              </div>
            )) : (
              <p className="text-gray-400">No cards played yet</p>
            )}
          </div>
        </Card>

        {/* Your Hand */}
        <Card className="bg-white/10 p-6 mb-6">
          <p className="text-sm mb-4 text-center">Your Hand ({myHand.length} cards)</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {myHand.map((card, i) => (
              <PlayingCard
                key={`myHand-${i}`}
                card={card}
                onClick={() => handleCardPlay(card)}
                disabled={!isMyTurn}
              />
            ))}
          </div>
        </Card>

        <div className="flex gap-4 justify-center">
          <Button data-testid="mp-hearts-leave-btn" onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-gray-700">
            <ArrowLeft className="w-5 h-5 mr-2" />Leave Game
          </Button>
        </div>
      </div>
    </div>
  );
}
