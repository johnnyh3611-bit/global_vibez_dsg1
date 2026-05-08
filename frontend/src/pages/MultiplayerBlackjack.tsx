import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, Coins, DollarSign, Timer, Trophy } from 'lucide-react';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay, { ConfettiCelebration } from '@/components/ParticleEffectsOverlay';
import TurnIndicator from '@/components/games/TurnIndicator';
import { ChipToss } from '@/components/games/CasinoCinematics';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Card component (reuse from poker)
const BlackjackCard = ({ card, faceDown = false }) => {
  if (!card || card.hidden || faceDown) {
    return (
      <div className="w-20 h-28 bg-gradient-to-br from-blue-900 to-purple-900 rounded-lg border-2 border-white/30 flex items-center justify-center shadow-lg">
        <div className="text-white/50 text-3xl">🂠</div>
      </div>
    );
  }

  const getSuitSymbol = (suit) => {
    const suits = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return suits[suit] || '';
  };

  const getSuitColor = (suit) => {
    return (suit === 'hearts' || suit === 'diamonds') ? 'text-red-500' : 'text-gray-900';
  };

  return (
    <motion.div
      initial={{ rotateY: 180, scale: 0 }}
      animate={{ rotateY: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="w-20 h-28 bg-white rounded-lg border-2 border-gray-300 shadow-xl flex flex-col items-center justify-center"
    >
      <div className={`text-3xl font-bold ${getSuitColor(card.suit)}`}>
        {card.rank}
      </div>
      <div className={`text-4xl ${getSuitColor(card.suit)}`}>
        {getSuitSymbol(card.suit)}
      </div>
    </motion.div>
  );
};

// Player spot component
const PlayerSpot = ({ player, isCurrentTurn }) => {
  if (!player || !player.is_active) {
    return (
      <div className="w-full opacity-30">
        <div className="border-2 border-dashed border-white/30 rounded-xl p-4 flex items-center justify-center min-h-[100px]">
          <Users className="w-8 h-8 text-white/30" />
        </div>
      </div>
    );
  }

  const getStatusBadge = () => {
    if (player.is_bust) return <span className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded">BUST</span>;
    if (player.is_blackjack) return <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-1 rounded">BLACKJACK!</span>;
    if (player.is_standing) return <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">Stand</span>;
    return null;
  };

  return (
    <Card className={`p-4 ${isCurrentTurn ? 'bg-green-900/30 border-green-400 border-2' : 'bg-slate-900/70'} border-slate-700`}>
      {/* Player info */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <div className="text-white font-bold">{player.name}</div>
          <div className="text-sm text-gray-400">Balance: ₵{(player.balance || 0).toLocaleString()}</div>
        </div>
        {player.current_bet > 0 && (
          <div className="text-right">
            <div className="text-sm text-gray-400">Bet</div>
            <div className="text-lg font-bold text-yellow-400">₵{player.current_bet.toLocaleString()}</div>
          </div>
        )}
      </div>

      {/* Hand */}
      {player.hand && player.hand.length > 0 && (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {player.hand.map((card, i) => (
              <BlackjackCard key={`hand-${i}`} card={card} />
            ))}
          </div>
          <div className="flex justify-between items-center">
            <div className="text-xl font-bold text-cyan-400">
              Score: {player.score}
            </div>
            {getStatusBadge()}
          </div>
          {player.winnings !== 0 && (
            <div className={`text-lg font-bold ${player.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {player.winnings > 0 ? '+' : ''} ${player.winnings}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default function MultiplayerBlackjack() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [table, setTable] = useState(null);
  const [playerName] = useState(localStorage.getItem('username') || 'Player');
  const [userId] = useState(localStorage.getItem('user_id') || null);  // Get user_id for balance persistence
  const [mySessionId, setMySessionId] = useState(null);
  const [betAmount, setBetAmount] = useState(50);
  const [error, setError] = useState('');
  
  // AAA Card Juice - Particle effects
  const [showConfetti, setShowConfetti] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null);

  useEffect(() => {
    const newSocket = io(API_URL, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setMySessionId(newSocket.id);

      if (roomCode) {
        newSocket.emit('join_blackjack_room', { room_code: roomCode, player_name: playerName, user_id: userId });
      } else {
        newSocket.emit('create_blackjack_room', { player_name: playerName, user_id: userId, min_bet: 10, max_bet: 500 });
      }
    });

    newSocket.on('blackjack_table_created', (data) => {
      if (data.success) {
        setTable(data.table);
        navigate(`/multiplayer-blackjack/${data.room_code}`, { replace: true });
      }
    });

    newSocket.on('blackjack_state_update', (data) => {
      setTable(data.table);
    });

    newSocket.on('blackjack_action_made', (data) => {
    });

    newSocket.on('error', (data) => {
      // console.error('❌ Blackjack error:', data.message);
      setError(data.message);
      setTimeout(() => setError(''), 5000);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const handleStartRound = () => {
    if (socket) {
      socket.emit('start_blackjack_round', {});
    }
  };

  const [chipTossActive, setChipTossActive] = useState(false);

  const handlePlaceBet = () => {
    cardSoundManager.playCardSlam(); // AAA Card Juice - Bet placement sound
    // Cinematic chip toss — flies from the bet input to the table center.
    setChipTossActive(true);
    if (socket) {
      socket.emit('blackjack_bet', { amount: betAmount });
    }
  };

  const handleAction = (action) => {
    cardSoundManager.playCardFlip(); // AAA Card Juice - Action sound
    
    if (socket) {
      socket.emit('blackjack_action', { action });
    }
  };

  const handleLeaveTable = () => {
    if (socket) {
      socket.emit('leave_blackjack_table', {});
    }
    navigate('/games');
  };

  const getMyPlayer = () => {
    if (!table || !mySessionId) return null;
    return table.players.find(p => p.session_id === mySessionId);
  };

  const getCurrentPlayer = () => {
    if (!table) return null;
    return table.players[table.current_player_index];
  };

  const isMyTurn = () => {
    const currentPlayer = getCurrentPlayer();
    return currentPlayer && currentPlayer.session_id === mySessionId && table.game_state === 'player_turns';
  };

  const myPlayer = getMyPlayer();

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Connecting to blackjack server...</div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading blackjack table...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 p-4">
      {/* Phase 3 cinematic — chip toss on bet placement (LOCKED 2026-02-16) */}
      <ChipToss
        active={chipTossActive}
        from={{ x: 0, y: 240 }}
        to={{ x: 0, y: -40 }}
        amount={betAmount}
        onComplete={() => setChipTossActive(false)}
      />
      <div className="container mx-auto py-8">
        {/* Universal turn indicator (LOCKED 2026-02-16 — every multiplayer room) */}
        {gameState && gameState.phase !== 'game_over' && (
          <TurnIndicator
            role={isMyTurn() ? 'me' : (gameState.phase === 'dealer_play' ? 'dealer' : 'opponent')}
            customLabel={
              gameState.phase === 'betting' ? 'PLACE YOUR BET' :
              gameState.phase === 'dealer_play' ? 'DEALER REVEALING' :
              undefined
            }
          />
        )}
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button
            variant="ghost"
            onClick={handleLeaveTable}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="mr-2 h-5 w-5" />
            Leave Table
          </Button>
          
          <div className="text-white text-center">
            <div className="text-sm opacity-70">Room Code</div>
            <div className="text-2xl font-bold font-mono">{table.room_code}</div>
          </div>

          <div className="text-white text-right">
            <div className="text-sm opacity-70">Round</div>
            <div className="font-bold">#{table.round_number}</div>
          </div>
        </div>

        {/* Error display */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-white text-center"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-6xl mx-auto">
          {/* Dealer Section */}
          <Card className="bg-slate-800/50 border-slate-700 p-6 mb-6">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-2">🎩 Dealer</h2>
              {table.dealer_hand && table.dealer_hand.length > 0 && (
                <div className="flex gap-2 justify-center mb-3">
                  {table.dealer_hand.map((card, i) => (
                    <BlackjackCard key={`dealer_hand-${i}`} card={card} />
                  ))}
                </div>
              )}
              {table.game_state !== 'waiting' && table.game_state !== 'betting' && (
                <div className="text-2xl font-bold text-cyan-400">
                  Score: {table.dealer_score > 0 ? table.dealer_score : '?'}
                </div>
              )}
            </div>
          </Card>

          {/* Players Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {table.players.map((player) => (
              <PlayerSpot
                key={player.session_id}
                player={player}
                isCurrentTurn={player.is_current_turn}
              />
            ))}
          </div>

          {/* Action Controls */}
          <Card className="p-6 bg-slate-900/90 border-slate-700">
            {table.game_state === 'waiting' && (
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-cyan-400" />
                <div className="text-xl font-bold text-white mb-2">Waiting for Players</div>
                <div className="text-sm text-gray-400 mb-4">
                  {table.players.filter(p => p.is_active).length} / 5 players
                </div>
                {table.players.filter(p => p.is_active).length >= 1 && (
                  <Button
                    onClick={handleStartRound}
                    className="bg-gradient-to-r from-green-600 to-emerald-600"
                    data-testid="blackjack-start-round"
                  >
                    Start Round
                  </Button>
                )}
                {/* AI-Bot fallback so the user can see real BJ gameplay alone. */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-cyan-200 mb-2">
                    Want to see the table now? Practice vs the AI dealer:
                  </p>
                  <Button
                    onClick={() => navigate('/blackjack-universal')}
                    variant="outline"
                    className="border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/10"
                    data-testid="blackjack-play-vs-ai"
                  >
                    🤖 Play vs AI Dealer
                  </Button>
                </div>
              </div>
            )}

            {table.game_state === 'betting' && myPlayer && (
              <div className="text-center">
                <div className="text-xl font-bold text-white mb-4">Place Your Bet</div>
                <div className="flex gap-3 items-center justify-center mb-4">
                  <Input
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
                    min={table.min_bet}
                    max={table.max_bet}
                    className="w-32 bg-slate-800 text-white text-center text-xl"
                  />
                  <Button
                    onClick={handlePlaceBet}
                    disabled={myPlayer.current_bet > 0}
                    className="bg-gradient-to-r from-yellow-600 to-orange-600"
                  >
                    <DollarSign className="mr-2" />
                    {myPlayer.current_bet > 0 ? 'Bet Placed' : 'Place Bet'}
                  </Button>
                </div>
                <div className="text-sm text-gray-400">
                  Min: ${table.min_bet} | Max: ${table.max_bet}
                </div>
              </div>
            )}

            {table.game_state === 'player_turns' && (
              isMyTurn() ? (
                <div>
                  <div className="text-white text-center mb-4 text-xl font-bold text-green-400">
                    🎯 Your Turn!
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button
                      onClick={() => handleAction('hit')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      👋 Hit
                    </Button>
                    <Button
                      onClick={() => handleAction('stand')}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      ✋ Stand
                    </Button>
                    {myPlayer && myPlayer.hand.length === 2 && (
                      <Button
                        onClick={() => handleAction('double')}
                        disabled={myPlayer.current_bet > myPlayer.balance}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        ⬆️ Double Down
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-white text-center">
                  <Timer className="w-6 h-6 mx-auto mb-2 animate-pulse" />
                  <div>Waiting for {getCurrentPlayer()?.name}...</div>
                </div>
              )
            )}

            {table.game_state === 'dealer_turn' && (
              <div className="text-white text-center">
                <div className="text-xl font-bold mb-2">Dealer Playing...</div>
                <div className="text-sm text-gray-400">Dealer must hit on 16 or less</div>
              </div>
            )}

            {table.game_state === 'round_complete' && (
              <div className="text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
                <div className="text-2xl font-bold text-white mb-4">Round Complete!</div>
                <div className="mb-4 space-y-2">
                  {table.players.filter(p => p.current_bet > 0).map((player) => (
                    <div key={player.session_id} className="text-white">
                      <span className="font-bold">{player.name}:</span>
                      <span className={`ml-2 ${player.winnings > 0 ? 'text-green-400' : player.winnings < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {player.winnings > 0 ? '+' : ''} ${player.winnings}
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={handleStartRound}
                  className="bg-gradient-to-r from-green-600 to-emerald-600"
                >
                  Next Round
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
      
      {/* AAA Card Juice - Particle Effects */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger} />
      <ConfettiCelebration active={showConfetti} />
    </div>
  );
}
