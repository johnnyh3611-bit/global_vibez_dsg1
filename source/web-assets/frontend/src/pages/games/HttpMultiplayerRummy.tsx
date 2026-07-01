
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';

const PlayingCard = ({ card, onClick, disabled }: { card: any; onClick?: () => void; disabled?: boolean }) => {
  if (!card) return <div className="w-12 h-18 bg-gray-700 rounded border-2 border-gray-600" />;
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
      whileHover={!disabled ? { scale: 1.05 } : {}}
      onClick={onClick}
      className={`w-12 h-18 bg-white rounded border-2 flex flex-col items-center justify-center ${
        isRed ? 'text-red-600' : 'text-black'
      } ${disabled ? '' : 'cursor-pointer'}`}
    >
      <div className="text-sm font-bold">{displayRank}</div>
      <div className="text-lg">{suitSymbol}</div>
    </motion.div>
  );
};

export default function HttpMultiplayerRummy() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();

  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, makeMove, endGame, leaveGame } = useHttpMultiplayer(userId, userName, urlGameId);

  const myRole = gameState?.my_role;
  const myHand = gameState?.game_state?.[`${myRole}_hand`] || [];
  const discardPile = gameState?.game_state?.discard_pile || [];
  const topDiscard = discardPile[discardPile.length - 1];
  const isCompleted = gameState?.status === 'completed';
  const winnerRole = gameState?.winner || myRole;

  const handleDrawCard = async () => {
    if (!isMyTurn) return;
    const deck = gameState.game_state.deck || [];
    if (deck.length === 0) return;

    const drawnCard = deck[0];
    const newDeck = deck.slice(1);
    const newHand = [...myHand, drawnCard];

    cardSoundManager.playCardDeal?.();
    await makeMove({ action: 'draw' }, {
      ...gameState.game_state,
      [`${myRole}_hand`]: newHand,
      deck: newDeck
    });
  };

  const handleDiscard = async (card) => {
    if (!isMyTurn) return;
    const newHand = myHand.filter(c => c !== card);
    const newDiscard = [...discardPile, card];

    cardSoundManager.playCardSlam?.();
    await makeMove({ action: 'discard', card }, {
      ...gameState.game_state,
      [`${myRole}_hand`]: newHand,
      discard_pile: newDiscard
    });

    if (newHand.length === 0) {
      await endGame(myRole);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div> {/* audit:allow-animate */}
          <h2 className="text-2xl font-bold mb-4">Loading game...</h2>
          <Button data-testid="mp-rummy-back-to-lobby" onClick={() => navigate('/http-multiplayer')}>Back to Lobby</Button>
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
        gameLabel="Rummy"
        winnerRole={winnerRole as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="rummy-game-over"
      />
    );
  }

  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white p-4 relative overflow-hidden" data-testid="rummy-game">
      <div className="max-w-6xl mx-auto relative z-10">
        

        {/* Player Info */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className={`p-4 ${myRole === 'player1' ? 'bg-purple-600/30 border-purple-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player1Name}</p>
            <p className="text-sm text-gray-300">{myRole === 'player1' ? myHand.length : '?'} cards</p>
          </Card>
          <Card className={`p-4 ${myRole === 'player2' ? 'bg-purple-600/30 border-purple-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player2Name}</p>
            <p className="text-sm text-gray-300">{myRole === 'player2' ? myHand.length : '?'} cards</p>
          </Card>
        </div>

        {/* Turn Indicator */}
        <Card className={`p-4 mb-6 ${isMyTurn ? 'bg-green-600' : 'bg-gray-700'}`}>
          <p className="text-xl font-black text-center">
            {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}
          </p>
        </Card>

        {/* Game Area */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-purple-900/50 p-6 flex flex-col items-center justify-center">
            <p className="text-sm mb-2">Draw Pile</p>
            <PlayingCard card={null} disabled />
            <Button onClick={handleDrawCard} disabled={!isMyTurn} className="mt-4" data-testid="rummy-draw-btn">Draw Card</Button>
          </Card>

          <Card className="bg-white/10 p-6 flex flex-col items-center justify-center">
            <p className="text-sm mb-2">Discard Pile</p>
            <PlayingCard card={topDiscard} disabled />
          </Card>
        </div>

        {/* Your Hand */}
        <Card className="bg-white/10 p-6 mb-6">
          <p className="text-sm mb-4 text-center">Your Hand ({myHand.length} cards)</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {myHand.map((card, i) => (
              <PlayingCard
                key={`myHand-${i}`}
                card={card}
                onClick={() => handleDiscard(card)}
                disabled={!isMyTurn}
              />
            ))}
          </div>
        </Card>

        <div className="flex gap-4 justify-center">
          <Button data-testid="mp-rummy-leave-btn" onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-gray-700">
            <ArrowLeft className="w-5 h-5 mr-2" />Leave Game
          </Button>
        </div>
      </div>
    </div>
  );
}
