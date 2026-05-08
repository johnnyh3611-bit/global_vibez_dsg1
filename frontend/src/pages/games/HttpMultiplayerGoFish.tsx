
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Fish } from 'lucide-react';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';

const PlayingCard = ({ card, onClick, disabled }: { card: any; onClick?: () => void; disabled?: boolean }) => {
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
      } ${disabled ? 'opacity-50' : 'cursor-pointer hover:shadow-xl'}`}
    >
      <div className="text-sm font-bold">{displayRank}</div>
      <div className="text-2xl">{suitSymbol}</div>
    </motion.div>
  );
};

export default function HttpMultiplayerGoFish() {
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();

  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, makeMove, leaveGame } = useHttpMultiplayer(userId, userName, urlGameId);

  const myRole = gameState?.my_role;
  const myHand = gameState?.game_state?.[`${myRole}_hand`] || [];
  const myBooks = gameState?.game_state?.[`${myRole}_books`] || [];
  const opponentRole = myRole === 'player1' ? 'player2' : 'player1';
  const opponentHandCount = gameState?.game_state?.[`${opponentRole}_hand`]?.length || 0;
  const opponentBooks = gameState?.game_state?.[`${opponentRole}_books`] || [];
  const isCompleted = gameState?.status === 'completed';
  const computedWinner = myBooks.length >= opponentBooks.length ? myRole : opponentRole;
  const winnerRole = gameState?.winner || computedWinner;

  const handleAsk = async (rank) => {
    if (!isMyTurn || isCompleted) return;

    cardSoundManager.playCardDeal?.();
    await makeMove({ action: 'ask', rank }, gameState.game_state);
  };

  const availableRanks: string[] = Array.from(new Set(myHand.map((card: string) => card.slice(0, -1))));

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-blue-900 via-cyan-900 to-teal-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div> {/* audit:allow-animate */}
          <h2 className="text-2xl font-bold mb-4">Loading game...</h2>
          <Button data-testid="mp-go-fish-back-to-lobby" onClick={() => navigate('/http-multiplayer')}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    const iWon = winnerRole === myRole && myBooks.length > opponentBooks.length;
    return (
      <WinCelebration
        won={iWon}
        gameId={gameId}
        userId={userId}
        gameLabel="Go Fish"
        subtitle={`Books: ${myBooks.length} vs ${opponentBooks.length}`}
        winnerRole={winnerRole as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="gofish-game-over"
      />
    );
  }

  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-blue-900 via-cyan-900 to-teal-900 text-white p-4 relative overflow-hidden" data-testid="gofish-game">
      <div className="max-w-6xl mx-auto relative z-10">
        

        {/* Books Display */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className={`p-4 ${myRole === 'player1' ? 'bg-blue-600/30 border-blue-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player1Name}</p>
            <div className="flex items-center gap-2 mt-2">
              <Fish className="w-6 h-6 text-blue-400" />
              <span className="text-3xl font-black text-blue-400">{myRole === 'player1' ? myBooks.length : opponentBooks.length}</span>
              <span className="text-sm">books</span>
            </div>
            <p className="text-xs text-gray-300 mt-1">{myRole === 'player1' ? myHand.length : opponentHandCount} cards in hand</p>
          </Card>
          <Card className={`p-4 ${myRole === 'player2' ? 'bg-blue-600/30 border-blue-400 border-2' : 'bg-white/10'}`}>
            <p className="font-bold">{player2Name}</p>
            <div className="flex items-center gap-2 mt-2">
              <Fish className="w-6 h-6 text-blue-400" />
              <span className="text-3xl font-black text-blue-400">{myRole === 'player2' ? myBooks.length : opponentBooks.length}</span>
              <span className="text-sm">books</span>
            </div>
            <p className="text-xs text-gray-300 mt-1">{myRole === 'player2' ? myHand.length : opponentHandCount} cards in hand</p>
          </Card>
        </div>

        {/* Turn Indicator */}
        <Card className={`p-4 mb-6 ${isMyTurn ? 'bg-green-600' : 'bg-gray-700'}`}>
          <p className="text-xl font-black text-center">
            {isMyTurn ? '🎮 YOUR TURN! Ask for a rank' : '⏳ Opponent\'s Turn'}
          </p>
        </Card>

        {/* Ask for Rank */}
        {isMyTurn && availableRanks.length > 0 && (
          <Card className="bg-white/10 p-6 mb-6">
            <h3 className="text-lg font-bold mb-4 text-center">Ask opponent for a rank:</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {availableRanks.map(rank => (
                <Button
                  key={rank}
                  onClick={() => handleAsk(rank)}
                  className="bg-blue-600 hover:bg-blue-700 text-xl px-6 py-4 font-bold"
                  data-testid={`gofish-ask-${rank}-btn`}
                >
                  {rank}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {/* Your Books */}
        {myBooks.length > 0 && (
          <Card className="bg-green-900/30 p-4 mb-6">
            <p className="text-sm mb-2 text-center">Your Books</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {myBooks.map((rank, i) => (
                <div key={`myBooks-${i}`} className="bg-green-600 px-4 py-2 rounded-lg font-bold text-xl">
                  {rank}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Your Hand */}
        <Card className="bg-white/10 p-6 mb-6">
          <p className="text-sm mb-4 text-center">Your Hand ({myHand.length} cards)</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {myHand.map((card, i) => <PlayingCard key={`myHand-${i}`} card={card} disabled />)}
          </div>
        </Card>

        <div className="flex gap-4 justify-center">
          <Button data-testid="mp-go-fish-leave-btn" onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-gray-700">
            <ArrowLeft className="w-5 h-5 mr-2" />Leave Game
          </Button>
        </div>
      </div>
    </div>
  );
}
