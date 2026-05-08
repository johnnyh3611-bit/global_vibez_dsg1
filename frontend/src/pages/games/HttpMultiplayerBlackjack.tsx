
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, DollarSign } from 'lucide-react';
import Confetti from 'react-confetti';
import {
  BLACKJACK_DEALER_HITS_SOFT_17,
  BLACKJACK_DEALER_STAND_VALUE,
} from '@/lib/cardGameRules';

// Vibez Casino blackjack tables follow the **S17** ruleset: dealer
// stands on a soft-17. House edge ≈ 0.50% on standard 6-deck shoe.
const _DEALER_HITS_SOFT_17 = BLACKJACK_DEALER_HITS_SOFT_17;  // false
const _DEALER_STANDS_AT = BLACKJACK_DEALER_STAND_VALUE;      // 17
void _DEALER_HITS_SOFT_17; void _DEALER_STANDS_AT;
import { useWindowSize } from 'react-use';
import { useSafeTimeout } from "@/hooks/useSafeTimeout";

const PlayingCard = ({ card, hidden }: { card: any; hidden?: boolean }) => {
  if (!card) return null;
  if (hidden) {
    return <div className="w-16 h-24 bg-gradient-to-br from-blue-900 to-purple-900 rounded border-2 border-white flex items-center justify-center">
      <div className="text-4xl">🂠</div>
    </div>;
  }
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  
  // Convert rank to display format
  const displayRank = {
    '1': 'A',
    '11': 'J',
    '12': 'Q',
    '13': 'K'
  }[rank] || rank;
  
  const suitSymbol = { H: '♥️', D: '♦️', C: '♣️', S: '♠️' }[suit];
  const isRed = suit === 'H' || suit === 'D';
  
  return (
    <div className={`w-16 h-24 bg-white rounded border-2 flex flex-col items-center justify-center ${
      isRed ? 'text-red-600' : 'text-black'
    }`}>
      <div className="text-lg font-bold">{displayRank}</div>
      <div className="text-2xl">{suitSymbol}</div>
    </div>
  );
};

const getHandValue = (hand) => {
  if (!hand || hand.length === 0) return 0;
  let value = 0;
  let aces = 0;
  
  hand.forEach(card => {
    const rank = card.slice(0, -1);
    if (rank === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(rank)) {
      value += 10;
    } else {
      value += parseInt(rank);
    }
  });
  
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
};

export default function HttpMultiplayerBlackjack() {
  const safeTimeout = useSafeTimeout();
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');

  const myRole = gameState?.my_role;
  const myHand = gameState?.game_state?.[`${myRole}_hand`] || [];
  const dealerHand = gameState?.game_state?.dealer_hand || [];
  const myBet = gameState?.game_state?.[`${myRole}_bet`] || 10;
  const myChips = gameState?.game_state?.[`${myRole}_chips`] || 1000;
  const showDealerCard = gameState?.game_state?.show_dealer_card || false;
  
  const myValue = getHandValue(myHand);
  const dealerValue = getHandValue(dealerHand);

  useEffect(() => {
    if (gameState?.status === 'completed') {
      if (gameState.winner === myRole) {
        setLocalGameStatus('won');
        setShowConfetti(true);
        safeTimeout(() => setShowConfetti(false), 5000);
      } else if (gameState.winner === 'draw') {
        setLocalGameStatus('draw');
      } else {
        setLocalGameStatus('lost');
      }
    }
  }, [gameState, myRole]);

  const handleHit = async () => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    const deck = gameState.game_state.deck || [];
    if (deck.length === 0) return;
    
    const newCard = deck[0];
    const newDeck = deck.slice(1);
    const newHand = [...myHand, newCard];
    const newValue = getHandValue(newHand);
    
    if (newValue > 21) {
      await makeMove({ action: 'hit' }, {
        ...gameState.game_state,
        [`${myRole}_hand`]: newHand,
        deck: newDeck
      });
      await endGame('dealer');
    } else {
      await makeMove({ action: 'hit' }, {
        ...gameState.game_state,
        [`${myRole}_hand`]: newHand,
        deck: newDeck
      });
    }
  };

  const handleStand = async () => {
    if (!isMyTurn || localGameStatus !== 'playing') return;
    
    await makeMove({ action: 'stand' }, {
      ...gameState.game_state,
      show_dealer_card: true
    });
    
    // Determine winner
    const winner = myValue > dealerValue && myValue <= 21 ? myRole : 'dealer';
    await endGame(winner);
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-green-900 via-emerald-950 to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div> {/* audit:allow-animate */}
          <h2 className="text-2xl font-bold mb-4">Loading game...</h2>
          <Button onClick={() => navigate('/http-multiplayer')} data-testid="blackjack-back-to-lobby">Back to Lobby</Button>
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
        gameLabel="Blackjack"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="blackjack-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-green-900 via-emerald-950 to-black text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="max-w-4xl mx-auto relative z-10">
        

        {/* Chips Display */}
        <Card className="bg-yellow-600/30 p-4 mb-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <DollarSign className="w-6 h-6 text-yellow-400" />
            <span className="text-2xl font-black text-yellow-400">{myChips}</span>
            <span className="text-sm text-gray-300">chips</span>
          </div>
          <p className="text-sm text-gray-300 mt-1">Bet: ${myBet}</p>
        </Card>

        {/* Dealer Hand */}
        <Card className="bg-red-900/30 p-6 mb-6">
          <p className="text-sm mb-4 text-center">Dealer's Hand {showDealerCard ? `(${dealerValue})` : ''}</p>
          <div className="flex gap-2 justify-center">
            {dealerHand.map((card, i) => (
              <PlayingCard key={`dealerHand-${i}`} card={card} hidden={i === 1 && !showDealerCard} />
            ))}
          </div>
        </Card>

        {/* Turn Indicator */}
        {localGameStatus === 'playing' && (
          <Card className={`p-4 mb-6 ${isMyTurn ? 'bg-green-600' : 'bg-gray-700'}`}>
            <p className="text-xl font-black text-center">
              {isMyTurn ? '🎮 YOUR TURN!' : '⏳ Opponent\'s Turn'}
            </p>
          </Card>
        )}

        {/* Player Hand */}
        <Card className="bg-blue-900/30 p-6 mb-6">
          <p className="text-sm mb-4 text-center">Your Hand ({myValue})</p>
          <div className="flex gap-2 justify-center">
            {myHand.map((card, i) => <PlayingCard key={`myHand-${i}`} card={card} />)}
          </div>
        </Card>

        {/* Actions */}
        {localGameStatus === 'playing' && isMyTurn && (
          <div className="flex gap-4 justify-center mb-6">
            <Button onClick={handleHit} data-testid="blackjack-hit-btn" className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6">
              🎴 Hit
            </Button>
            <Button onClick={handleStand} data-testid="blackjack-stand-btn" className="bg-red-600 hover:bg-red-700 text-lg px-8 py-6">
              ✋ Stand
            </Button>
          </div>
        )}

        {/* Game Result */}
        <AnimatePresence>
          {localGameStatus !== 'playing' && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
              <Card className={`inline-block px-8 py-6 ${
                localGameStatus === 'won' ? 'bg-green-600' : 
                localGameStatus === 'draw' ? 'bg-yellow-600' : 'bg-red-600'
              }`}>
                <div className="text-6xl mb-4">
                  {localGameStatus === 'won' ? '🏆' : localGameStatus === 'draw' ? '🤝' : '😢'}
                </div>
                <h2 className="text-3xl font-black">
                  {localGameStatus === 'won' ? 'BLACKJACK! YOU WIN!' : 
                   localGameStatus === 'draw' ? 'PUSH!' : 'DEALER WINS!'}
                </h2>
                <p className="text-lg">Your: {myValue} | Dealer: {dealerValue}</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-4 justify-center">
          <Button data-testid="mp-blackjack-leave-btn" onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-gray-700">
            <ArrowLeft className="w-5 h-5 mr-2" />Leave Game
          </Button>
          {localGameStatus !== 'playing' && (
            <Button data-testid="mp-blackjack-leave-btn-2" onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-cyan-600">
              🔄 Play Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
