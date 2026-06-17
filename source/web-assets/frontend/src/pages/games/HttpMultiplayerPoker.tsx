
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import WinCelebration from '@/components/games/WinCelebration';
import cardSoundManager from '@/utils/cardSoundManager';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Coins, Volume2 } from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { POKER_HAND_RANKS } from '@/lib/cardGameRules';

// Standard 10-rank Poker hand-rank table (highest → lowest):
// ROYAL_FLUSH > STRAIGHT_FLUSH > FOUR_OF_A_KIND > FULL_HOUSE > FLUSH >
// STRAIGHT > THREE_OF_A_KIND > TWO_PAIR > PAIR > HIGH_CARD
const _HAND_RANK_TABLE = POKER_HAND_RANKS;
void _HAND_RANK_TABLE;
import { useSafeTimeout } from "@/hooks/useSafeTimeout";

// Chip Component with denominations
const PokerChip = ({ value, count = 1, size = 'normal', animate = false }) => {
  const getChipColor = (val) => {
    if (val >= 100) return 'from-gray-900 to-gray-700'; // Black - 100+ coin chip
    if (val >= 50) return 'from-green-700 to-green-900'; // Green - 50 coin chip
    if (val >= 25) return 'from-blue-700 to-blue-900'; // Blue - 25 coin chip
    if (val >= 10) return 'from-red-700 to-red-900'; // Red - 10 coin chip
    return 'from-white to-gray-300'; // White - low denomination chip
  };

  const sizeClasses = size === 'small' ? 'w-8 h-8 text-xs' : size === 'large' ? 'w-16 h-16 text-lg' : 'w-12 h-12 text-sm';
  
  return (
    <motion.div
      initial={animate ? { scale: 0, rotate: 0 } : false}
      animate={animate ? { scale: 1, rotate: 360 } : {}}
      transition={{ type: 'spring', stiffness: 200 }}
      className="relative"
    >
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <div
          key={`chip-${value}-${i}`}
          className={`absolute ${sizeClasses} rounded-full bg-gradient-to-br ${getChipColor(value)} border-4 border-white/50 shadow-2xl flex items-center justify-center font-black text-white`}
          style={{ 
            top: `-${i * 3}px`, 
            left: `${i * 3}px`,
            zIndex: 3 - i
          }}
        >
          ₵{value}
        </div>
      ))}
      {count > 3 && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold border-2 border-white" style={{ zIndex: 10 }}>
          {count}
        </div>
      )}
    </motion.div>
  );
};

const PlayingCard = ({ card }) => {
  if (!card) return <div className="w-16 h-24 bg-gray-700 rounded border-2 border-gray-600" />;
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

export default function HttpMultiplayerPoker() {
  const safeTimeout = useSafeTimeout();
  const navigate = useNavigate();
  const { gameId: urlGameId } = useParams();
  const { width, height } = useWindowSize();
  
  const [userId] = useState(() => localStorage.getItem('mp_user_id') || 'user_' + Math.random().toString(36).substr(2, 9));
  const [userName] = useState(() => localStorage.getItem('mp_user_name') || 'Player');

  const { connected, gameId, gameState, isMyTurn, opponent, error, makeMove, endGame, leaveGame, clearError } = useHttpMultiplayer(userId, userName, urlGameId);

  const [showConfetti, setShowConfetti] = useState(false);
  const [localGameStatus, setLocalGameStatus] = useState('playing');
  const [betAmount, setBetAmount] = useState(50);
  const [animateChips, setAnimateChips] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Audio context for chip sounds
  const audioContextRef = useRef(null);
  
  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  }, []);
  
  // Play chip sound effect
  const playChipSound = () => {
    if (!soundEnabled || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  };

  const myRole = gameState?.my_role;
  const myHand = gameState?.game_state?.[`${myRole}_hand`] || [];
  const communityCards = gameState?.game_state?.community_cards || [];
  const pot = gameState?.game_state?.pot || 0;
  const myChips = gameState?.game_state?.[`${myRole}_chips`] || 1000;
  const opponentRole = myRole === 'player1' ? 'player2' : 'player1';
  const opponentChips = gameState?.game_state?.[`${opponentRole}_chips`] || 1000;
  const currentBet = gameState?.game_state?.current_bet || 0;

  useEffect(() => {
    if (gameState?.status === 'completed') {
      if (gameState.winner === myRole) {
        setLocalGameStatus('won');
        setShowConfetti(true);
        safeTimeout(() => setShowConfetti(false), 5000);
      } else {
        setLocalGameStatus('lost');
      }
    }
  }, [gameState, myRole, setLocalGameStatus, setShowConfetti]);

  const handleBet = async (amount) => {
    playChipSound();
    setAnimateChips(true);
    safeTimeout(() => setAnimateChips(false), 500);
    
    await makeMove({ action: 'bet', amount }, {
      ...gameState.game_state,
      pot: pot + amount,
      [`${myRole}_chips`]: myChips - amount,
      current_bet: amount
    });
  };

  const handleFold = async () => {
    await endGame(opponentRole);
  };
  
  const quickBet = (amount) => {
    if (myChips >= amount) {
      handleBet(amount);
    }
  };

  if (!connected || !gameId || !gameState) {
    return (
      <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-spin">🔄</div> {/* audit:allow-animate */}
          <h2 className="text-2xl font-bold mb-4">Loading game...</h2>
          <Button data-testid="mp-poker-back-to-lobby" onClick={() => navigate('/http-multiplayer')}>Back to Lobby</Button>
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
        gameLabel="Poker"
        winnerRole={(serverWinner || myRole) as 'player1' | 'player2'}
        onBack={() => { leaveGame(); navigate('/http-multiplayer'); }}
        testId="poker-game-over"
      />
    );
  }


  const player1Name = gameState.player1?.name || 'Player 1';
  const player2Name = gameState.player2?.name || opponent?.name || 'Player 2';

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-gradient-to-br from-green-900 via-emerald-900 to-teal-900 text-white p-4 relative overflow-hidden">
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}

      <div className="max-w-6xl mx-auto relative z-10">
        

        {/* Sound Toggle */}
        <div className="absolute top-4 right-4 z-20">
          <Button
            onClick={() => setSoundEnabled(!soundEnabled)}
            data-testid="poker-sound-toggle"
            aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            className={`${soundEnabled ? 'bg-green-600' : 'bg-gray-600'} rounded-full w-12 h-12 p-0`}
          >
            <Volume2 className="w-6 h-6" />
          </Button>
        </div>

        {/* Player Info with Chip Stacks */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-white/10 p-4">
            <p className="font-bold mb-2">{player1Name}</p>
            <div className="flex items-center gap-4">
              <div className="relative">
                <PokerChip value={100} count={Math.floor((myRole === 'player1' ? myChips : opponentChips) / 100)} size="small" />
              </div>
              <div>
                <p className="text-2xl font-black text-yellow-400">₵{(myRole === 'player1' ? myChips : opponentChips).toLocaleString()}</p>
                <p className="text-xs text-gray-300">chips</p>
              </div>
            </div>
          </Card>
          <Card className="bg-white/10 p-4">
            <p className="font-bold mb-2">{player2Name}</p>
            <div className="flex items-center gap-4">
              <div className="relative">
                <PokerChip value={100} count={Math.floor((myRole === 'player2' ? myChips : opponentChips) / 100)} size="small" />
              </div>
              <div>
                <p className="text-2xl font-black text-yellow-400">₵{(myRole === 'player2' ? myChips : opponentChips).toLocaleString()}</p>
                <p className="text-xs text-gray-300">chips</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Pot with Animated Chips */}
        <Card className="bg-yellow-600/30 p-6 mb-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-20">
            <PokerChip value={100} size="large" animate={animateChips} />
            <PokerChip value={50} size="large" animate={animateChips} />
            <PokerChip value={25} size="large" animate={animateChips} />
          </div>
          <p className="text-sm text-gray-300 relative z-10">Pot</p>
          <p className="text-5xl font-black text-yellow-400 relative z-10 mb-2">₵{pot.toLocaleString()}</p>
          <div className="flex gap-2 justify-center relative z-10">
            {pot >= 100 && <PokerChip value={100} count={Math.floor(pot / 100)} />}
            {pot >= 50 && <PokerChip value={50} count={Math.floor((pot % 100) / 50)} />}
            {pot >= 10 && <PokerChip value={10} count={Math.floor((pot % 50) / 10)} />}
          </div>
        </Card>

        {/* Community Cards */}
        <Card className="bg-white/10 p-6 mb-6">
          <p className="text-sm mb-4 text-center">Community Cards</p>
          <div className="flex gap-2 justify-center">
            {communityCards.length > 0 ? communityCards.map((card, i) => (
              <PlayingCard key={`community-${card.suit}-${card.rank}-${i}`} card={card} />
            )) : (
              <p className="text-gray-400">No community cards yet</p>
            )}
          </div>
        </Card>

        {/* Your Hand */}
        <Card className="bg-white/10 p-6 mb-6">
          <p className="text-sm mb-4 text-center">Your Hand</p>
          <div className="flex gap-2 justify-center">
            {myHand.map((card, i) => <PlayingCard key={`hand-${card.suit}-${card.rank}-${i}`} card={card} />)}
          </div>
        </Card>

        {/* Enhanced Betting UI */}
        {localGameStatus === 'playing' && isMyTurn && (
          <Card className="bg-white/10 p-6 mb-6">
            <h3 className="text-lg font-bold mb-4 text-center">Your Bet</h3>
            
            {/* Chip Selection */}
            <div className="flex gap-3 justify-center mb-4 flex-wrap">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => quickBet(10)}
                disabled={myChips < 10}
                className="disabled:opacity-30"
              >
                <PokerChip value={10} size="normal" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => quickBet(25)}
                disabled={myChips < 25}
                className="disabled:opacity-30"
              >
                <PokerChip value={25} size="normal" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => quickBet(50)}
                disabled={myChips < 50}
                className="disabled:opacity-30"
              >
                <PokerChip value={50} size="normal" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => quickBet(100)}
                disabled={myChips < 100}
                className="disabled:opacity-30"
              >
                <PokerChip value={100} size="normal" />
              </motion.button>
            </div>

            {/* Bet Slider */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Bet Amount: ${betAmount}</span>
                <span>Max: ${myChips}</span>
              </div>
              <input
                type="range"
                min="10"
                max={myChips}
                step="10"
                value={betAmount}
                onChange={(e) => setBetAmount(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <Button 
                onClick={() => handleBet(betAmount)} 
                disabled={myChips < betAmount}
                data-testid="poker-bet-button"
                className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 font-bold text-lg px-8 py-6"
              >
                💰 Bet ₵{betAmount}
              </Button>
              <Button 
                onClick={handleFold} 
                data-testid="poker-fold-button"
                className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 font-bold text-lg px-8 py-6"
              >
                ❌ Fold
              </Button>
            </div>
          </Card>
        )}

        {/* Game Result */}
        <AnimatePresence>
          {localGameStatus !== 'playing' && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center mb-6">
              <Card className={`inline-block px-8 py-6 ${localGameStatus === 'won' ? 'bg-green-600' : 'bg-red-600'}`}>
                <div className="text-6xl mb-4">{localGameStatus === 'won' ? '🏆' : '😢'}</div>
                <h2 className="text-3xl font-black">{localGameStatus === 'won' ? 'YOU WIN!' : 'YOU LOSE!'}</h2>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-4 justify-center">
          <Button data-testid="mp-poker-leave-btn" onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-gray-700">
            <ArrowLeft className="w-5 h-5 mr-2" />Leave Game
          </Button>
          {localGameStatus !== 'playing' && (
            <Button data-testid="mp-poker-leave-btn-2" onClick={() => { leaveGame(); navigate('/http-multiplayer'); }} className="bg-cyan-600">
              🔄 Play Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
