import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, Coins, Crown, Timer, Video, VideoOff } from 'lucide-react';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay, { ConfettiCelebration } from '@/components/ParticleEffectsOverlay';
import SpatialVideoTable, { useSpatialVideo } from '@/components/SpatialVideoTable';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Card component
const PokerCard = ({ card, faceDown = false, small = false }) => {
  if (!card || card.hidden || faceDown) {
    return (
      <div className={`${small ? 'w-12 h-16' : 'w-16 h-24'} bg-gradient-to-br from-blue-900 to-purple-900 rounded-lg border-2 border-white/30 flex items-center justify-center shadow-lg`}>
        <div className="text-white/50 text-2xl">🂠</div>
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
      className={`${small ? 'w-12 h-16' : 'w-16 h-24'} bg-white rounded-lg border-2 border-gray-300 shadow-xl flex flex-col items-center justify-center relative overflow-hidden`}
    >
      <div className={`${small ? 'text-lg' : 'text-2xl'} font-bold ${getSuitColor(card.suit)}`}>
        {card.rank}
      </div>
      <div className={`${small ? 'text-xl' : 'text-3xl'} ${getSuitColor(card.suit)}`}>
        {getSuitSymbol(card.suit)}
      </div>
    </motion.div>
  );
};

// Player seat component
const PlayerSeat = ({ player, isCurrentTurn, seatPosition, totalSeats }) => {
  const getPositionClass = () => {
    // Position seats around table (ellipse layout)
    const positions = {
      0: 'bottom-0 left-1/2 -translate-x-1/2',  // Bottom center (you)
      1: 'bottom-1/4 right-4',  // Bottom right
      2: 'top-1/3 right-4',  // Right
      3: 'top-0 left-1/2 -translate-x-1/2',  // Top center
      4: 'top-1/3 left-4',  // Left
      5: 'bottom-1/4 left-4'  // Bottom left
    };
    return positions[seatPosition] || 'bottom-0 left-1/2';
  };

  if (!player || !player.is_active) {
    return (
      <div className={`absolute ${getPositionClass()} w-32 h-40 opacity-30`}>
        <div className="w-full h-full border-2 border-dashed border-white/30 rounded-xl flex items-center justify-center">
          <Users className="w-8 h-8 text-white/30" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`absolute ${getPositionClass()} w-32`}
    >
      <div className={`relative ${isCurrentTurn ? 'ring-4 ring-green-400 rounded-xl' : ''}`}>
        {/* Player info card */}
        <Card className={`p-3 ${player.is_folded ? 'bg-gray-800/50' : 'bg-slate-900/90'} border ${isCurrentTurn ? 'border-green-400' : 'border-slate-700'}`}>
          <div className="flex flex-col gap-2">
            {/* Name and status */}
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-sm truncate">{player.name}</span>
              {player.is_dealer && <Crown className="w-4 h-4 text-yellow-400" />}
            </div>
            
            {/* Chips */}
            <div className="flex items-center gap-1 text-green-400">
              <Coins className="w-4 h-4" />
              <span className="text-sm font-bold">₵{(player.chips || 0).toLocaleString()}</span>
            </div>
            
            {/* Current bet */}
            {player.current_bet > 0 && (
              <div className="text-xs text-cyan-400">
                Bet: ₵{player.current_bet.toLocaleString()}
              </div>
            )}
            
            {/* Status badges */}
            <div className="flex gap-1">
              {player.is_folded && (
                <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded">Folded</span>
              )}
              {player.is_all_in && (
                <span className="text-xs bg-yellow-900/50 text-yellow-300 px-2 py-0.5 rounded">All-In</span>
              )}
            </div>
          </div>
        </Card>
        
        {/* Hole cards */}
        {player.hole_cards && player.hole_cards.length > 0 && (
          <div className="flex gap-1 mt-2 justify-center">
            {player.hole_cards.map((card, i) => (
              <PokerCard key={card.id || `hole_cards-${i}`} card={card} small />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default function MultiplayerPoker() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [table, setTable] = useState(null);
  const [playerName, setPlayerName] = useState(localStorage.getItem('username') || 'Player');
  const [mySessionId, setMySessionId] = useState(null);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [error, setError] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null);

  // Spatial Video Integration
  const { videoEnabled, remoteConnected, startVideo, stopVideo } = useSpatialVideo(socketRef, roomCode);

  useEffect(() => {
    // Initialize Socket.IO connection
    const newSocket = io(API_URL, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true
    });

    setSocket(newSocket);
    socketRef.current = newSocket; // Store in ref for useSpatialVideo hook

    newSocket.on('connect', () => {
      setConnected(true);
      setMySessionId(newSocket.id);

      // Join or create room
      if (roomCode) {
        newSocket.emit('join_poker_room', { room_code: roomCode, player_name: playerName });
      } else {
        newSocket.emit('create_poker_room', { player_name: playerName, buy_in: 1000, small_blind: 10 });
      }
    });

    newSocket.on('poker_table_created', (data) => {
      if (data.success) {
        setTable(data.table);
        // Update URL with room code
        navigate(`/multiplayer-poker/${data.room_code}`, { replace: true });
      }
    });

    newSocket.on('poker_state_update', (data) => {
      setTable(data.table);
      
      // Play sounds based on game state
      if (data.table) {
        // Cards dealt
        if (data.table.phase === 'pre-flop' || data.table.phase === 'flop' || 
            data.table.phase === 'turn' || data.table.phase === 'river') {
          cardSoundManager.playCardDeal();
        }
        
        // Hand complete - check if I won
        if (data.table.phase === 'showdown') {
          const myPlayer = data.table.players?.find(p => p.session_id === mySessionId);
          if (myPlayer && data.table.winners?.includes(myPlayer.name)) {
            cardSoundManager.playWinSound();
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
          } else if (myPlayer && data.table.phase === 'showdown' && data.table.winners) {
            cardSoundManager.playLoseSound();
          }
        }
      }
    });

    newSocket.on('poker_action_made', (data) => {
      
      // Play chip sound for bets/raises/calls
      if (data.action === 'bet' || data.action === 'raise' || data.action === 'call') {
        cardSoundManager.playChipClink();
      } else if (data.action === 'fold') {
        cardSoundManager.playCardFlip();
      }
    });

    newSocket.on('error', (data) => {
      // console.error('❌ Poker error:', data.message);
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

  const handleStartGame = () => {
    if (socket) {
      socket.emit('start_poker', {});
    }
  };

  const handlePokerAction = (action, amount = 0) => {
    if (socket) {
      socket.emit('poker_action', { action, amount });
    }
  };

  const handleLeaveTable = () => {
    if (socket) {
      socket.emit('leave_poker_table', {});
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
    return currentPlayer && currentPlayer.session_id === mySessionId;
  };

  const myPlayer = getMyPlayer();
  const currentPlayer = getCurrentPlayer();

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Connecting to poker server...</div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading poker table...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-slate-900 p-4">
      <div className="container mx-auto py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-3">
            <Button
              variant="ghost"
              onClick={handleLeaveTable}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Leave Table
            </Button>

            {/* Video Toggle */}
            <Button
              variant="ghost"
              onClick={() => videoEnabled ? stopVideo() : startVideo()}
              className={videoEnabled 
                ? 'bg-green-600/80 border-green-400/30 text-white' 
                : 'text-white hover:bg-white/10'
              }
            >
              {videoEnabled ? (
                <div className="relative flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  {remoteConnected && (
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                </div>
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </Button>
          </div>
          
          <div className="text-white text-center">
            <div className="text-sm opacity-70">Room Code</div>
            <div className="text-2xl font-bold font-mono">{table.room_code}</div>
          </div>

          <div className="text-white text-right">
            <div className="text-sm opacity-70">Blinds</div>
            <div className="font-bold">₵{table.small_blind}/₵{table.big_blind}</div>
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

        {/* Poker Table */}
        <div className="relative w-full max-w-5xl mx-auto">
          {/* Table felt (ellipse) */}
          <div className="relative mx-auto" style={{ width: '900px', height: '600px' }}>
            {/* Felt background */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-800 to-green-900 rounded-[50%] border-8 border-amber-900 shadow-2xl">
              {/* Inner felt line */}
              <div className="absolute inset-12 border-4 border-amber-800/50 rounded-[50%]"></div>
              
              {/* Center area - Pot and community cards */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                {/* Pot */}
                <div className="mb-6">
                  <div className="text-yellow-300 text-lg font-semibold mb-2">POT</div>
                  <div className="text-white text-4xl font-bold bg-black/30 px-6 py-2 rounded-full">
                    ${table.pot}
                  </div>
                </div>

                {/* Community Cards */}
                {table.community_cards && table.community_cards.length > 0 && (
                  <div className="flex gap-2 justify-center mt-6">
                    {table.community_cards.map((card, i) => (
                      <PokerCard key={card.id || `community_cards-${i}`} card={card} />
                    ))}
                  </div>
                )}

                {/* Game state indicator */}
                {table.game_state && (
                  <div className="mt-4 text-cyan-300 font-semibold text-sm uppercase tracking-wide">
                    {table.game_state.replace('_', ' ')}
                  </div>
                )}
              </div>
            </div>

            {/* Player seats */}
            {table.players.map((player, index) => (
              <PlayerSeat
                key={player.session_id}
                player={player}
                isCurrentTurn={player.is_current_turn}
                seatPosition={index}
                totalSeats={table.players.length}
              />
            ))}
          </div>

          {/* Action Controls */}
          {myPlayer && table.game_state !== 'waiting' && table.game_state !== 'hand_complete' && (
            <Card className="mt-6 p-6 bg-slate-900/90 border-slate-700">
              {isMyTurn() ? (
                <div>
                  <div className="text-white text-center mb-4 text-xl font-bold text-green-400">
                    🎯 Your Turn!
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button
                      onClick={() => handlePokerAction('fold')}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Fold
                    </Button>
                    
                    {table.current_bet === 0 || myPlayer.current_bet >= table.current_bet ? (
                      <Button
                        onClick={() => handlePokerAction('check')}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Check
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handlePokerAction('call')}
                        className="bg-yellow-600 hover:bg-yellow-700"
                      >
                        Call ${table.current_bet - myPlayer.current_bet}
                      </Button>
                    )}
                    
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        value={raiseAmount}
                        onChange={(e) => setRaiseAmount(parseInt(e.target.value) || 0)}
                        placeholder="Amount"
                        min={table.current_bet * 2}
                        max={myPlayer.chips}
                        className="w-32 bg-slate-800 text-white"
                      />
                      <Button
                        onClick={() => handlePokerAction('raise', raiseAmount)}
                        disabled={raiseAmount < table.current_bet * 2}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Raise
                      </Button>
                    </div>
                    
                    <Button
                      onClick={() => handlePokerAction('all_in')}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      All-In (${myPlayer.chips})
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-white text-center">
                  <Timer className="w-6 h-6 mx-auto mb-2 animate-pulse" />
                  <div>Waiting for {currentPlayer?.name}...</div>
                </div>
              )}
            </Card>
          )}

          {/* Waiting for players */}
          {table.game_state === 'waiting' && (
            <Card className="mt-6 p-6 bg-slate-900/90 border-slate-700 text-center">
              <div className="text-white">
                <Users className="w-12 h-12 mx-auto mb-4 text-cyan-400" />
                <div className="text-xl font-bold mb-2">Waiting for Players</div>
                <div className="text-sm opacity-70 mb-4">
                  {table.players.filter(p => p.is_active).length} / 6 players
                </div>
                {table.players.filter(p => p.is_active).length >= 2 && (
                  <Button
                    onClick={handleStartGame}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    data-testid="poker-start-game"
                  >
                    Start Game
                  </Button>
                )}
                {/* AI-Bot fallback so the user can see the actual table UI
                    without needing 5 more humans to join. */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <p className="text-xs text-cyan-200 mb-2">
                    Want to see the table now? Practice vs AI bots:
                  </p>
                  <Button
                    onClick={() => navigate('/poker-practice')}
                    variant="outline"
                    className="border-cyan-400/50 text-cyan-200 hover:bg-cyan-500/10"
                    data-testid="poker-play-vs-ai"
                  >
                    🤖 Play vs AI Bots
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Hand complete - winners */}
          {table.game_state === 'hand_complete' && table.winners && table.winners.length > 0 && (
            <Card className="mt-6 p-6 bg-slate-900/90 border-slate-700 text-center">
              <div className="text-white">
                <Crown className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
                <div className="text-2xl font-bold mb-4">🎉 Winner{table.winners.length > 1 ? 's' : ''}!</div>
                {table.winners.map((winner, i) => (
                  <div key={`winners-${i}`} className="mb-2">
                    <div className="text-xl font-semibold text-green-400">{winner.name}</div>
                    <div className="text-sm text-cyan-300">{winner.hand_name}</div>
                    <div className="text-lg text-yellow-400">Won ${winner.winnings}</div>
                  </div>
                ))}
                <Button
                  onClick={handleStartGame}
                  className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600"
                >
                  Next Hand
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Particle Effects Overlay */}
      <ParticleEffectsOverlay triggerSparkle={particleTrigger} />

      {/* Confetti Celebration on Win */}
      <ConfettiCelebration active={showConfetti} />

      {/* Spatial Video Table - WebRTC video chat */}
      <SpatialVideoTable
        enabled={videoEnabled && connected}
        position="opposite"
        onConnectionChange={(status) => {
        }}
      />
    </div>
  );
}
