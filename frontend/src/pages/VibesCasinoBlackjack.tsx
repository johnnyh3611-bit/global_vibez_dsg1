
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Coins, Trophy, Volume2, VolumeX, DollarSign, Sparkles, Video, VideoOff } from 'lucide-react';
import MetaHumanDealer from '@/components/MetaHumanDealer';
import { CasinoSounds } from '@/utils/casinoSounds';
import cardSoundManager from '@/utils/cardSoundManager';
import ParticleEffectsOverlay, { ConfettiCelebration } from '@/components/ParticleEffectsOverlay';
import dealerVoice, { DealerCallouts } from '@/utils/dealerVoice';
import casinoSounds from '@/utils/casinoSoundManager';
import SpatialVideoTable, { useSpatialVideo } from '@/components/SpatialVideoTable';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Casino Card Component with REALISTIC dealing animation from dealer's hand
const CasinoCard = ({ card, faceDown = false, dealAnimation = false, fromDealer = false, toPosition = { x: 0, y: 0 }, isFinalCard = false }) => {
  if (!card || card.hidden || faceDown) {
    return (
      <motion.div
        initial={fromDealer ? { 
          x: toPosition.x, 
          y: toPosition.y, 
          opacity: 0, 
          rotateX: 180,
          scale: 0.8
        } : false}
        animate={{ 
          x: 0, 
          y: 0, 
          opacity: 1, 
          rotateX: 0,
          scale: 1
        }}
        transition={{ 
          type: 'spring', 
          damping: 18, 
          stiffness: 120,
          duration: isFinalCard ? 2.5 : 0.6
        }}
        className="w-16 h-24 bg-gradient-to-br from-red-900 to-red-950 rounded-lg border-2 border-yellow-600/50 flex items-center justify-center shadow-2xl"
      >
        <div className="w-full h-full rounded-lg bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzMzMyIgc3Ryb2tlLXdpZHRoPSIwLjUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
      </motion.div>
    );
  }

  const getSuitSymbol = (suit) => {
    const suits = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return suits[suit] || '';
  };

  const getSuitColor = (suit) => {
    return (suit === 'hearts' || suit === 'diamonds') ? 'text-red-600' : 'text-black';
  };

  // Dramatic slow-motion animation for final card
  const dramaticTransition = isFinalCard ? {
    type: 'tween',
    ease: [0.16, 1, 0.3, 1], // Dramatic cubic-bezier easing
    duration: 2.5
  } : {
    type: 'spring',
    damping: 16,
    stiffness: 100,
    duration: 0.8
  };

  return (
    <motion.div
      initial={fromDealer ? { 
        x: toPosition.x, 
        y: toPosition.y, 
        opacity: 0, 
        rotateX: 180, 
        rotateZ: -15,
        scale: 0.7
      } : { 
        rotateY: 180, 
        scale: 0 
      }}
      animate={{ 
        x: 0, 
        y: 0, 
        opacity: 1, 
        rotateX: 0, 
        rotateY: 0, 
        rotateZ: 0,
        scale: isFinalCard ? [0.7, 1.15, 1] : 1 // Extra emphasis with scale pulse for final card
      }}
      transition={dramaticTransition as any}
      className={`relative w-16 h-24 bg-white rounded-lg border-2 ${
        isFinalCard ? 'border-yellow-400 shadow-[0_0_30px_rgba(255,215,0,0.8)]' : 'border-gray-200'
      } shadow-2xl`}
    >
      {/* Card content */}
      <div className="absolute inset-0 flex flex-col items-center justify-between p-1.5">
        {/* Top corner */}
        <div className={`${getSuitColor(card.suit)} font-['JetBrains_Mono'] font-bold text-base leading-none`}>
          <div>{card.rank}</div>
          <div className="text-lg">{getSuitSymbol(card.suit)}</div>
        </div>
        
        {/* Center suit */}
        <div className={`${getSuitColor(card.suit)} text-4xl`}>
          {getSuitSymbol(card.suit)}
        </div>
        
        {/* Bottom corner (rotated) */}
        <div className={`${getSuitColor(card.suit)} font-['JetBrains_Mono'] font-bold text-base leading-none rotate-180`}>
          <div>{card.rank}</div>
          <div className="text-lg">{getSuitSymbol(card.suit)}</div>
        </div>
      </div>

      {/* Glossy effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent rounded-lg pointer-events-none" />
    </motion.div>
  );
};

// Casino Chip Component
const CasinoChip = ({ value, selected, onClick }) => {
  const chipColors = {
    10: 'from-blue-500 to-blue-700',
    25: 'from-green-500 to-green-700',
    50: 'from-red-500 to-red-700',
    100: 'from-gray-800 to-gray-900',
    500: 'from-purple-500 to-purple-700'
  };

  const handleClick = () => {
    cardSoundManager.playChipClink();
    onClick && onClick();
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.1, y: -5 }}
      whileTap={{ scale: 0.95 }}
      className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${chipColors[value] || chipColors[50]} 
        border-4 border-white/30 shadow-2xl cursor-pointer transition-all
        ${selected ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.6)]' : ''}`}
    >
      {/* Chip design */}
      <div className="absolute inset-0 rounded-full border-4 border-white/10" />
      <div className="absolute inset-2 rounded-full border-2 border-dashed border-white/40" />
      
      {/* Value */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-['JetBrains_Mono'] font-black text-sm drop-shadow-lg">
          ${value}
        </span>
      </div>
    </motion.button>
  );
};

export default function VibesCasinoBlackjack() {
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [table, setTable] = useState(null);
  const [playerName] = useState(localStorage.getItem('username') || 'Player');
  const [mySessionId, setMySessionId] = useState(null);
  const [selectedChip, setSelectedChip] = useState(50);
  const [betAmount, setBetAmount] = useState(50);
  const [error, setError] = useState('');
  const [dealerSpeech, setDealerSpeech] = useState('Welcome to Global Vibez Casino');
  const [casinoSounds] = useState(() => new CasinoSounds());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [previousDealerCardCount, setPreviousDealerCardCount] = useState(0);
  const [previousPlayerCardCounts, setPreviousPlayerCardCounts] = useState({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState(null);

  // Spatial Video Integration
  const { videoEnabled, remoteConnected, startVideo, stopVideo } = useSpatialVideo(socketRef, roomCode);

  // Start casino ambiance on mount
  useEffect(() => {
    casinoSounds.startAmbiance();
    return () => casinoSounds.stopAmbiance();
  }, [casinoSounds]);

  // Track card counts to identify newly dealt cards
  useEffect(() => {
    if (table) {
      // Update dealer card count
      if (table.dealer?.hand) {
        setPreviousDealerCardCount(table.dealer.hand.length);
      }
      
      // Update player card counts
      if (table.players) {
        const newCounts = {};
        table.players.forEach((player, idx) => {
          if (player.hand) {
            newCounts[idx] = player.hand.length;
          }
        });
        setPreviousPlayerCardCounts(newCounts);
      }
    }
  }, [table?.dealer?.hand?.length, table?.players]);

  useEffect(() => {
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
      setDealerSpeech('Place your bets, please');

      if (roomCode) {
        newSocket.emit('join_blackjack_room', { room_code: roomCode, player_name: playerName });
      } else {
        newSocket.emit('create_blackjack_room', { player_name: playerName, min_bet: 10, max_bet: 500 });
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
      
      // Play card dealing sound with enhanced audio
      if (data.table?.status === 'dealing') {
        casinoSounds.playCardDeal();
        cardSoundManager.playCardDeal(); // Enhanced deal sound
        dealerVoice.speak(DealerCallouts.STARTING_HAND); // Dealer announces
      }
      
      // Update dealer speech based on game state
      if (data.table?.status === 'dealing') {
        setDealerSpeech('Cards coming out');
        casinoSounds.playDealerSpeak();
      } else if (data.table?.status === 'betting') {
        setDealerSpeech('Place your bets');
      } else if (data.table?.status === 'finished') {
        // Check for wins and play appropriate sounds
        const myPlayer = data.table?.players?.find(p => p.session_id === mySessionId);
        if (myPlayer?.result === 'win') {
          cardSoundManager.playWinSound();
          dealerVoice.speak(DealerCallouts.NICE_HAND); // Dealer congratulates
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        } else if (myPlayer?.result === 'blackjack') {
          cardSoundManager.playWinSound();
          dealerVoice.speak(DealerCallouts.BJ_PLAYER_BLACKJACK); // Dealer announces blackjack
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 3000);
        } else if (myPlayer?.result === 'bust') {
          cardSoundManager.playLoseSound();
          dealerVoice.speak(DealerCallouts.TOUGH_LUCK); // Dealer response
        } else if (myPlayer?.result === 'lose') {
          cardSoundManager.playLoseSound();
        }
      }
    });

    newSocket.on('blackjack_action_made', (data) => {
      if (data.action === 'hit') {
        setDealerSpeech('Card for the player');
        casinoSounds.playCardDeal();
      }
      if (data.action === 'stand') {
        setDealerSpeech('Player stands');
        dealerVoice.speak(DealerCallouts.BJ_DEALER_STANDS);
      }
      if (data.action === 'double') {
        casinoSounds.playChipBet();
        dealerVoice.speak(DealerCallouts.HIGH_STAKES_BET);
      }
    });

    newSocket.on('error', (data) => {
      setError(data.message);
      setTimeout(() => setError(''), 4000);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(newSocket);
    
    return () => {
      newSocket.close();
      socketRef.current = null;
    };
  }, []);

  const handlePlaceBet = () => {
    if (socket && betAmount > 0) {
      socket.emit('blackjack_bet', { amount: betAmount });
      setDealerSpeech('Bet accepted. Good luck!');
      casinoSounds.playChipBet(); // Play chip sound
      dealerVoice.speak(DealerCallouts.PLAYER_BET('Player', `$${betAmount}`)); // Dealer announces bet
    }
  };

  const handleAction = (action) => {
    if (socket) {
      socket.emit('blackjack_action', { action });
    }
  };

  const handleStartRound = () => {
    if (socket) {
      socket.emit('start_blackjack_round', {});
      setDealerSpeech('No more bets');
    }
  };

  const getMyPlayer = () => {
    if (!table || !mySessionId) return null;
    return table.players.find(p => p.session_id === mySessionId);
  };

  const myPlayer = getMyPlayer();
  const isMyTurn = table?.current_player_index !== null && 
    table?.players[table.current_player_index]?.session_id === mySessionId;

  return (
    <div className="fixed inset-0 bg-[#05050A] overflow-hidden">
      {/* ENHANCED CASINO ROOM DESIGN */}
      
      {/* Background casino room atmosphere */}
      <div className="absolute inset-0">
        {/* Deep casino room gradient - darker at edges, lit in center */}
        <div className="absolute inset-0 bg-gradient-radial from-[#1a0a2e]/80 via-[#0d0515]/90 to-black" />
        
        {/* Luxury velvet curtains on sides */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-purple-950/40 via-purple-900/20 to-transparent" />
        
        {/* Ceiling lighting effect */}
        <div className="absolute top-0 left-0 right-0 h-48 bg-gradient-to-b from-purple-900/20 via-transparent to-transparent" />
        
        {/* Main dealer spotlight - focused on dealer area */}
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-96 bg-gradient-radial from-purple-400/30 via-purple-500/15 to-transparent blur-3xl"
          animate={{
            opacity: [0.4, 0.6, 0.4],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        
        {/* Secondary pink accent light */}
        <motion.div
          className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-gradient-radial from-pink-500/20 via-transparent to-transparent blur-3xl"
          animate={{
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
        />
        
        {/* Floating golden sparkles for VIP atmosphere */}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={`sparkle-${i}`}
            className="absolute w-1 h-1 bg-yellow-400/50 rounded-full blur-sm"
            style={{
              left: `${15 + Math.random() * 70}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -150, 0],
              opacity: [0, 0.8, 0],
              scale: [0.5, 1, 0.5]
            }}
            transition={{
              duration: 8 + Math.random() * 6,
              repeat: Infinity,
              delay: Math.random() * 6,
              ease: "easeInOut"
            }}
          />
        ))}
        
        {/* Subtle wall texture */}
        <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSB0eXBlPSJmcmFjdGFsTm9pc2UiIGJhc2VGcmVxdWVuY3k9IjAuOSIgbnVtT2N0YXZlcz0iNCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==')]" />
      </div>

      {/* Sound control toggle */}
      <motion.button
        onClick={() => {
          const newState = casinoSounds.toggle();
          setSoundEnabled(newState);
        }}
        className="fixed bottom-4 left-4 z-50 bg-black/80 backdrop-blur-xl border border-white/10 p-3 rounded-xl hover:bg-black/90 transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {soundEnabled ? (
          <Volume2 className="w-5 h-5 text-purple-400" />
        ) : (
          <VolumeX className="w-5 h-5 text-gray-500" />
        )}
      </motion.button>

      {/* Video call toggle */}
      <motion.button
        onClick={() => {
          if (videoEnabled) {
            stopVideo();
          } else {
            startVideo();
          }
        }}
        className={`fixed bottom-4 left-20 z-50 backdrop-blur-xl border p-3 rounded-xl transition-all ${
          videoEnabled 
            ? 'bg-green-600/80 border-green-400/30 hover:bg-green-700/80' 
            : 'bg-black/80 border-white/10 hover:bg-black/90'
        }`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {videoEnabled ? (
          <div className="relative">
            <Video className="w-5 h-5 text-white" />
            {remoteConnected && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
          </div>
        ) : (
          <VideoOff className="w-5 h-5 text-gray-400" />
        )}
      </motion.button>

      {/* Main Grid Layout - 3 sections */}
      <div className="relative h-screen grid grid-rows-[48%_32%_20%]">
        
        {/* ===== DEALER SECTION (TOP 48%) - CLEAR VIEW, NO BLOCKING ===== */}
        <div className="relative overflow-hidden">
          {/* Dealer nameplate - positioned to not block dealer */}
          <motion.div
            className="absolute top-6 right-8 z-30"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.8 }}
          >
            <div className="bg-black/70 backdrop-blur-xl border border-purple-500/30 shadow-[0_0_20px_rgba(157,0,255,0.4)] px-5 py-2 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${table?.status === 'dealing' ? 'bg-green-400 animate-pulse' : 'bg-purple-400'}`} />
                <span className="text-white font-['Unbounded'] font-bold tracking-wider text-sm">NOVA</span>
              </div>
            </div>
          </motion.div>
          
          <MetaHumanDealer
            dealerType="nova"
            gameType="blackjack"
            gameState={{
              isDealing: table?.status === 'dealing',
              isShuffling: table?.status === 'waiting'
            }}
            size="normal"
          />
        </div>

        {/* ===== TABLE SECTION (MIDDLE 35%) ===== */}
        <div className="relative flex items-center justify-center px-8">
          {/* Semicircular Table */}
          <div className="relative w-full max-w-6xl">
            {/* Table felt */}
            <div className="relative">
              {/* Green felt surface */}
              <div className="w-full h-72 bg-gradient-to-b from-[#0A3B22] to-[#08311C] rounded-t-[500px] border-t-8 border-x-8 border-[#16161D] shadow-[0_0_60px_rgba(157,0,255,0.3),inset_0_2px_20px_rgba(0,0,0,0.6)]">
                {/* Subtle felt texture */}
                <div className="absolute inset-0 rounded-t-[500px] opacity-10 bg-[url('https://images.unsplash.com/photo-1601370690183-1c7796ecec61?w=400')] bg-cover mix-blend-overlay" />
                
                {/* Neon glow effect on rim */}
                <div className="absolute inset-0 rounded-t-[500px] shadow-[inset_0_0_30px_rgba(157,0,255,0.4)]" />

                {/* Dealer's hand (top center) - cards deal FROM dealer position */}
                {table?.dealer?.hand && table.dealer.hand.length > 0 && (
                  <div className="absolute top-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                      {table.dealer.hand.map((card, i) => {
                        // Mark the last card dealt to dealer as the dramatic final card
                        const isLastCard = i === table.dealer.hand.length - 1;
                        const isNewlyDealt = table.dealer.hand.length > previousDealerCardCount;
                        const isFinalDramaticCard = isLastCard && isNewlyDealt && table.status === 'dealing';
                        
                        return (
                          <CasinoCard 
                            key={`item-${i}`} 
                            card={card} 
                            faceDown={i === 1 && table.status !== 'completed'}
                            fromDealer={table.status === 'dealing'}
                            toPosition={{ x: 0, y: -250 }}
                            isFinalCard={isFinalDramaticCard}
                          />
                        );
                      })}
                    </div>
                    {table.dealer.score !== undefined && table.status === 'completed' && (
                      <div className="text-white font-['JetBrains_Mono'] font-bold text-xl bg-black/60 backdrop-blur-md px-4 py-1 rounded-full border border-white/20">
                        Dealer: {table.dealer.score}
                      </div>
                    )}
                  </div>
                )}

                {/* Player spots (bottom curved area) */}
                <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4 px-12">
                  {table?.players?.map((player, idx) => {
                    const isActive = player.is_active;
                    const isTurn = table.current_player_index === idx;
                    const isMe = player.session_id === mySessionId;

                    return (
                      <div key={`item-${idx}`} className="relative flex flex-col items-center gap-2">
                        {/* Betting circle */}
                        <div className={`w-20 h-20 rounded-full border-4 ${
                          isTurn ? 'border-yellow-400 shadow-[0_0_20px_rgba(255,215,0,0.8)] animate-pulse' :
                          isMe ? 'border-purple-400 shadow-[0_0_15px_rgba(157,0,255,0.6)]' :
                          'border-white/30'
                        } bg-black/40 backdrop-blur-sm flex items-center justify-center`}>
                          {player.current_bet > 0 && (
                            <span className="text-yellow-300 font-['JetBrains_Mono'] font-bold text-sm">
                              ${player.current_bet}
                            </span>
                          )}
                          {!player.current_bet && isActive && (
                            <Users className="w-6 h-6 text-white/40" />
                          )}
                        </div>

                        {/* Player cards - deal from dealer to player position */}
                        {player.hand && player.hand.length > 0 && (
                          <div className="absolute -top-28 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                            <div className="flex gap-1">
                              {player.hand.map((card, i) => {
                                // Mark the last card dealt to this player as dramatic if newly dealt
                                const isLastCard = i === player.hand.length - 1;
                                const previousCount = previousPlayerCardCounts[idx] || 0;
                                const isNewlyDealt = player.hand.length > previousCount;
                                const isFinalDramaticCard = isLastCard && isNewlyDealt && table.status === 'dealing';
                                
                                return (
                                  <CasinoCard 
                                    key={`item-${i}`} 
                                    card={card} 
                                    fromDealer={table.status === 'dealing'}
                                    toPosition={{ x: 0, y: -200 - (idx * 30) }}
                                    isFinalCard={isFinalDramaticCard}
                                  />
                                );
                              })}
                            </div>
                            {/* Score display */}
                            {player.score !== undefined && (
                              <div className={`font-['JetBrains_Mono'] font-bold text-base px-3 py-0.5 rounded-full ${
                                player.is_bust ? 'bg-red-900/80 text-red-300' :
                                player.is_blackjack ? 'bg-yellow-900/80 text-yellow-300' :
                                'bg-black/60 text-cyan-300'
                              } backdrop-blur-md border border-white/20`}>
                                {player.is_blackjack ? 'BLACKJACK!' : 
                                 player.is_bust ? 'BUST!' :
                                 player.score}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Player name */}
                        {isActive && (
                          <div className={`text-xs font-['Outfit'] ${isMe ? 'text-purple-300 font-bold' : 'text-white/70'}`}>
                            {player.name} {isMe && '(You)'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== BETTING UI (BOTTOM 20%) ===== */}
        <div className="relative flex items-end justify-center pb-4 px-4">
          <div className="w-full max-w-7xl grid grid-cols-3 gap-3">
            
            {/* Left Panel - Game Info */}
            <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="text-white font-['Unbounded'] font-bold text-sm">Table Info</h3>
              </div>
              <div className="space-y-2 text-sm font-['Outfit']">
                <div className="flex justify-between">
                  <span className="text-gray-400">Room Code:</span>
                  <span className="text-white font-mono">{roomCode || '---'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Players:</span>
                  <span className="text-white">{table?.players?.filter(p => p.is_active).length || 0}/7</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-bold ${
                    table?.status === 'betting' ? 'text-yellow-400' :
                    table?.status === 'dealing' ? 'text-green-400' :
                    'text-purple-400'
                  }`}>
                    {table?.status?.toUpperCase() || 'LOADING'}
                  </span>
                </div>
              </div>
            </div>

            {/* Center Panel - Betting & Actions */}
            <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              {table?.status === 'betting' && myPlayer && !myPlayer.current_bet ? (
                <div>
                  <h3 className="text-white font-['Unbounded'] font-bold text-sm mb-3 text-center">Place Your Bet</h3>
                  
                  {/* Chip selection */}
                  <div className="flex justify-center gap-2 mb-3">
                    {[10, 25, 50, 100, 500].map(value => (
                      <CasinoChip
                        key={value}
                        value={value}
                        selected={selectedChip === value}
                        onClick={() => {
                          setSelectedChip(value);
                          setBetAmount(value);
                        }}
                      />
                    ))}
                  </div>

                  <Button
                    onClick={handlePlaceBet}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-['Outfit'] font-bold py-6 text-lg shadow-[0_0_20px_rgba(157,0,255,0.5)] border-2 border-purple-400/50"
                  >
                    <Coins className="mr-2" /> Bet ${betAmount}
                  </Button>
                </div>
              ) : isMyTurn && !myPlayer?.is_standing && !myPlayer?.is_bust ? (
                <div className="space-y-2">
                  <h3 className="text-white font-['Unbounded'] font-bold text-sm mb-3 text-center">Your Turn</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => {
                        handleAction('hit');
                        cardSoundManager.playCardSlam();
                      }}
                      className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-['Outfit'] font-bold py-3"
                    >
                      HIT
                    </Button>
                    <Button
                      onClick={() => {
                        handleAction('stand');
                        cardSoundManager.playCardFlip();
                      }}
                      className="bg-gradient-to-br from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-['Outfit'] font-bold py-3"
                    >
                      STAND
                    </Button>
                    {myPlayer?.hand?.length === 2 && (
                      <Button
                        onClick={() => handleAction('double')}
                        className="bg-gradient-to-br from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white font-['Outfit'] font-bold py-3 col-span-2"
                      >
                        DOUBLE DOWN
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full">
                  {table?.status === 'waiting' && (
                    <Button
                      onClick={handleStartRound}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-['Outfit'] font-bold py-6 px-8 text-lg"
                    >
                      Start New Round
                    </Button>
                  )}
                  {table?.status === 'dealing' && (
                    <p className="text-white/70 font-['Outfit'] animate-pulse">Dealing cards...</p>
                  )}
                </div>
              )}
            </div>

            {/* Right Panel - Player Stats */}
            <div className="bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-5 h-5 text-green-400" />
                <h3 className="text-white font-['Unbounded'] font-bold text-sm">Your Stats</h3>
              </div>
              {myPlayer ? (
                <div className="space-y-2 text-sm font-['Outfit']">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Balance:</span>
                    <span className="text-green-400 font-['JetBrains_Mono'] font-bold">₵{(myPlayer.balance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current Bet:</span>
                    <span className="text-yellow-400 font-['JetBrains_Mono'] font-bold">₵{(myPlayer.current_bet || 0).toLocaleString()}</span>
                  </div>
                  {myPlayer.winnings !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Win:</span>
                      <span className={`font-['JetBrains_Mono'] font-bold ${myPlayer.winnings > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {myPlayer.winnings > 0 ? '+' : ''}₵{Math.abs(myPlayer.winnings).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Loading player data...</p>
              )}
              
              <div className="mt-4 pt-4 border-t border-white/10">
                <Button
                  onClick={() => navigate('/games')}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10 font-['Outfit']"
                >
                  <ArrowLeft className="mr-2 w-4 h-4" /> Leave Table
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-900/90 backdrop-blur-xl border border-red-500/50 text-white px-6 py-3 rounded-xl shadow-2xl z-50"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connection indicator */}
      {!connected && (
        <div className="fixed top-4 right-4 bg-black/90 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white text-sm font-['Outfit']">Reconnecting...</span>
        </div>
      )}

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
