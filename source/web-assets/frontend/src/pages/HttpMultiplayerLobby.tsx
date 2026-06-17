import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHttpMultiplayer } from '@/hooks/useHttpMultiplayer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Users, Gamepad2, Zap, Link2, Crown } from 'lucide-react';
import WinnerTicker from '@/components/common/WinnerTicker';

export default function HttpMultiplayerLobby() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check for invite code in URL
  const urlParams = new URLSearchParams(location.search);
  const inviteCode = urlParams.get('invite');
  
  // Auto-detect user info from localStorage or generate
  const [userId] = useState(() => {
    const stored = localStorage.getItem('mp_user_id');
    if (stored) return stored;
    const newId = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('mp_user_id', newId);
    return newId;
  });
  
  // Auto-detect name from Google Auth or localStorage
  const [userName, setUserName] = useState(() => {
    // Try to get from Google Auth
    const googleUser = localStorage.getItem('google_user_name');
    if (googleUser) return googleUser;
    
    // Try saved name
    const savedName = localStorage.getItem('mp_user_name');
    if (savedName) return savedName;
    
    // Generate fun random name
    const adjectives = ['Swift', 'Clever', 'Mighty', 'Speedy', 'Epic', 'Cosmic'];
    const nouns = ['Fox', 'Panda', 'Tiger', 'Eagle', 'Wolf', 'Dragon'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
  });
  
  // Pre-select a game if deep-linked from /games-menu (?preselect=war, etc.)
  const preselectedGame = urlParams.get('preselect');

  // Remember last game played (preselect overrides stored choice)
  const [selectedGame, setSelectedGame] = useState(() =>
    preselectedGame || localStorage.getItem('mp_last_game') || null
  );
  
  // Quick play mode (skip game selection)
  const [quickPlayMode, setQuickPlayMode] = useState(false);

  const {
    connected,
    matchmaking,
    gameId,
    opponent,
    error,
    joinMatchmaking,
    leaveMatchmaking,
    clearError
  } = useHttpMultiplayer(userId, userName);

  // Save preferences
  useEffect(() => {
    if (userName) {
      localStorage.setItem('mp_user_name', userName);
    }
    if (selectedGame) {
      localStorage.setItem('mp_last_game', selectedGame);
    }
  }, [userName, selectedGame]);

  // Handle invite code
  useEffect(() => {
    if (inviteCode) {
      // Auto-join game from invite
      // In production, you'd validate the invite code with backend
      alert(`Joining game with invite code: ${inviteCode}`);
    }
  }, [inviteCode]);

  // ✅ DEEP-LINK FIX: when navigated here with ?preselect=<gameId>, auto-fire
  // matchmaking so the user goes STRAIGHT into a Spades / War / Hearts / etc.
  // room — instead of being shown the full grid of every multiplayer game.
  // Runs once on mount, only when we have a username + a preselect param.
  const [autoMatchmakingFired, setAutoMatchmakingFired] = useState(false);
  useEffect(() => {
    if (autoMatchmakingFired) return;
    if (!preselectedGame) return;
    if (!userName.trim()) return;
    if (matchmaking) return;
    setAutoMatchmakingFired(true);
    setSelectedGame(preselectedGame);
    setQuickPlayMode(true);
    joinMatchmaking(preselectedGame);
  }, [preselectedGame, userName, matchmaking, autoMatchmakingFired, joinMatchmaking]);

  // Navigate when match found - FIX THE NAVIGATION BUG!
  useEffect(() => {
    if (gameId && selectedGame) {
      // Use window.location for guaranteed navigation
      window.location.href = `/http-multiplayer-game/${selectedGame}/${gameId}`;
    }
  }, [gameId, selectedGame]);

  const games = [
    { 
      id: 'tictactoe', 
      name: 'Tic-Tac-Toe 12x12', 
      emoji: '⭕', 
      gradient: 'from-cyan-600 to-blue-700',
      description: 'Classic 3-in-a-row on 12x12!',
      duration: '~5 min'
    },
    { 
      id: 'connect4', 
      name: 'Connect 4 (18x19)', 
      emoji: '🔴', 
      gradient: 'from-red-600 to-orange-700',
      description: 'Strategic 4-in-a-row on massive grid',
      duration: '~8 min'
    },
    { 
      id: 'chess', 
      name: 'Chess', 
      emoji: '♟️', 
      gradient: 'from-gray-700 to-gray-900',
      description: 'Classic strategic chess battle',
      duration: '~15 min'
    },
    { 
      id: 'trivia', 
      name: 'Trivia Battle', 
      emoji: '🧠', 
      gradient: 'from-purple-600 to-indigo-700',
      description: 'Test your knowledge - 10 questions',
      duration: '~3 min'
    },
    { 
      id: 'uno', 
      name: 'UNO', 
      emoji: '🎴', 
      gradient: 'from-red-500 via-yellow-500 to-green-500',
      description: 'Classic card game - UNO!',
      duration: '~7 min'
    },
    { 
      id: 'poker', 
      name: 'Texas Hold\'em', 
      emoji: '♠️', 
      gradient: 'from-green-700 to-emerald-800',
      description: 'Poker - Bet, Bluff, Win',
      duration: '~10 min'
    },
    { 
      id: 'rummy', 
      name: 'Rummy', 
      emoji: '🃏', 
      gradient: 'from-purple-700 to-blue-800',
      description: 'Meld your cards to victory',
      duration: '~8 min'
    },
    { 
      id: 'hearts', 
      name: 'Hearts', 
      emoji: '♥️', 
      gradient: 'from-rose-600 to-pink-700',
      description: 'Romantic card game - Avoid hearts!',
      duration: '~10 min'
    },
    { 
      id: 'truthordare', 
      name: 'Truth or Dare', 
      emoji: '💋', 
      gradient: 'from-fuchsia-600 to-purple-700',
      description: 'Perfect ice breaker game',
      duration: '~5 min'
    },
    { 
      id: 'checkers', 
      name: 'Checkers', 
      emoji: '🟤', 
      gradient: 'from-amber-700 to-orange-800',
      description: 'Classic board game strategy',
      duration: '~12 min'
    },
    { 
      id: 'blackjack', 
      name: 'Blackjack', 
      emoji: '🃏', 
      gradient: 'from-green-800 to-emerald-950',
      description: 'Casino classic - Hit 21!',
      duration: '~5 min'
    },
    { 
      id: 'spades', 
      name: 'Spades', 
      emoji: '♠️', 
      gradient: 'from-gray-800 to-slate-900',
      description: 'Team trick-taking strategy',
      duration: '~12 min'
    },
    { 
      id: 'gofish', 
      name: 'Go Fish', 
      emoji: '🐟', 
      gradient: 'from-blue-700 to-cyan-800',
      description: 'Collect books of cards!',
      duration: '~8 min'
    },
    { 
      id: 'war', 
      name: 'War', 
      emoji: '⚔️', 
      gradient: 'from-red-700 to-rose-900',
      description: "Highest card wins. Tied? It's WAR.",
      duration: '~5 min'
    },
    { 
      id: 'crazy_eights', 
      name: 'Crazy Eights', 
      emoji: '🎱', 
      gradient: 'from-indigo-600 to-violet-800',
      description: "Proto-UNO. Match suit or rank. 8s are wild.",
      duration: '~7 min'
    },
    { 
      id: 'gin_rummy', 
      name: 'Gin Rummy', 
      emoji: '🍸', 
      gradient: 'from-emerald-600 to-teal-800',
      description: 'Form melds, knock when deadwood ≤10.',
      duration: '~10 min'
    },
    // 🌍 CULTURAL GAMES (10 Global Games)
    { 
      id: 'ludo', 
      name: 'Ludo', 
      emoji: '🎲', 
      gradient: 'from-red-600 via-yellow-500 to-green-600',
      description: 'Classic Indian dice race game',
      duration: '~15 min'
    },
    { 
      id: 'dominoes', 
      name: 'Dominoes', 
      emoji: '🀫', 
      gradient: 'from-gray-600 to-slate-700',
      description: 'Match tiles end-to-end',
      duration: '~10 min'
    },
    { 
      id: 'mancala', 
      name: 'Mancala', 
      emoji: '🪨', 
      gradient: 'from-amber-600 to-yellow-700',
      description: 'Ancient African seed sowing game',
      duration: '~10 min'
    },
    { 
      id: 'backgammon', 
      name: 'Backgammon', 
      emoji: '🎲', 
      gradient: 'from-brown-700 to-amber-800',
      description: 'Strategy dice and board game',
      duration: '~20 min'
    },
    { 
      id: 'chinesecheckers', 
      name: 'Chinese Checkers', 
      emoji: '⭐', 
      gradient: 'from-purple-600 via-blue-600 to-green-600',
      description: 'Star-shaped marble jumping game',
      duration: '~15 min'
    },
    { 
      id: 'parcheesi', 
      name: 'Parcheesi', 
      emoji: '🎲', 
      gradient: 'from-red-500 via-blue-500 to-green-500',
      description: 'American board game classic',
      duration: '~20 min'
    },
    { 
      id: 'mahjong', 
      name: 'Mahjong', 
      emoji: '🀄', 
      gradient: 'from-emerald-600 to-teal-700',
      description: 'Chinese tile-based strategy game',
      duration: '~25 min'
    },
    { 
      id: 'carrom', 
      name: 'Carrom', 
      emoji: '🎯', 
      gradient: 'from-amber-600 to-orange-700',
      description: 'Flick striker to pocket pieces',
      duration: '~15 min'
    },
    { 
      id: 'shogi', 
      name: 'Shogi', 
      emoji: '将', 
      gradient: 'from-red-800 to-orange-700',
      description: 'Japanese chess with promotions',
      duration: '~30 min'
    },
    { 
      id: 'xiangqi', 
      name: 'Xiangqi', 
      emoji: '象', 
      gradient: 'from-red-900 to-yellow-800',
      description: 'Chinese chess - Elephant Game',
      duration: '~25 min'
    }
  ];

  // ✅ AI-BOT FILL FALLBACK: when matchmaking has been searching for >8s
  // without finding an opponent, surface a "Play vs AI Bots" button so the
  // user can SEE the inside of the room without waiting for a 2nd human.
  // Maps each multiplayer game to its practice-mode entry point.
  const PRACTICE_ROUTES: Record<string, string> = {
    spades: '/spades',
    hearts: '/practice/play/hearts',
    rummy: '/rummy-practice',
    gin_rummy: '/practice/play/gin_rummy',
    war: '/practice/play/war',
    crazy_eights: '/practice/play/crazy_eights',
    gofish: '/practice/play/go_fish',
    poker: '/poker-practice',
    blackjack: '/practice/play/blackjack',
    tictactoe: '/practice/play/tictactoe',
    connect4: '/practice/play/connect4',
    chess: '/practice/play/chess',
    trivia: '/practice/play/trivia',
    checkers: '/practice/play/checkers',
    backgammon: '/practice/play/backgammon',
    mancala: '/practice/play/mancala',
    dominoes: '/practice/play/dominoes',
    ludo: '/practice/play/ludo',
    chinesecheckers: '/practice/play/chinesecheckers',
    parcheesi: '/practice/play/parcheesi',
    mahjong: '/practice/play/mahjong',
    carrom: '/practice/play/carrom',
    shogi: '/practice/play/shogi',
    xiangqi: '/practice/play/xiangqi',
    truthordare: '/practice/play/truth_or_dare',
  };
  const [showAiFallback, setShowAiFallback] = useState(false);
  useEffect(() => {
    if (!matchmaking) {
      setShowAiFallback(false);
      return;
    }
    const t = setTimeout(() => setShowAiFallback(true), 8000);
    return () => clearTimeout(t);
  }, [matchmaking]);

  const playVsAi = async () => {
    if (!selectedGame) return;
    leaveMatchmaking();
    const direct = PRACTICE_ROUTES[selectedGame];
    if (direct) {
      navigate(direct);
      return;
    }
    // Fallback: try the generic /api/practice/start endpoint.
    try {
      const apiBase = process.env.REACT_APP_BACKEND_URL;
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${apiBase}/api/practice/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ game_type: selectedGame, difficulty: 'medium' }),
      });
      if (res.ok) {
        const data = await res.json();
        navigate(`/practice/play/${data.game_id || selectedGame}`);
      } else {
        alert(`AI practice not yet available for ${selectedGame}.`);
      }
    } catch {
      alert('Could not start AI game — please try again.');
    }
  };

  const handleQuickPlay = (gameId) => {
    if (!userName.trim()) {
      alert('Please enter your name first!');
      return;
    }
    setSelectedGame(gameId);
    setQuickPlayMode(true);
    joinMatchmaking(gameId);
  };

  const handleFindMatch = () => {
    if (!userName.trim()) {
      alert('Please enter your name!');
      return;
    }
    if (!selectedGame) {
      alert('Please select a game!');
      return;
    }
    joinMatchmaking(selectedGame);
  };

  const generateInviteLink = (gameType) => {
    const inviteCode = Math.random().toString(36).substr(2, 8).toUpperCase();
    const link = `${window.location.origin}/http-multiplayer?invite=${inviteCode}&game=${gameType}`;
    navigator.clipboard.writeText(link);
    alert(`Invite link copied! Share with a friend:\n${link}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white relative overflow-hidden">
      <WinnerTicker className="sticky top-0 z-50" />
      <div className="p-4 relative">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/games')}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2 rounded-full border ${connected ? 'border-green-400' : 'border-red-400'}`}>
              <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm font-medium">
                {connected ? 'Connected (HTTP)' : 'Disconnected'}
              </span>
            </div>

            {/* Username Badge */}
            <div className="bg-gradient-to-r from-cyan-600 to-purple-600 px-4 py-2 rounded-full border border-white/30">
              <span className="text-sm font-bold">👤 {userName}</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl md:text-6xl font-black text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text mb-4"
          >
            ⚡ QUICK PLAY
          </motion.h1>
          <p className="text-lg text-gray-300">
            One-click multiplayer • Instant matching • Real-time sync
          </p>
        </div>

        {!matchmaking ? (
          <>
            {/* Edit Name (Optional) */}
            {!quickPlayMode && (
              <Card className="bg-white/10 backdrop-blur-xl border border-white/20 p-6 mb-6 max-w-md mx-auto">
                <label className="block text-sm font-bold mb-2">Your Name (Auto-Detected)</label>
                <Input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name..."
                  className="bg-white/20 border-white/30 text-white placeholder:text-gray-400 text-center text-xl font-bold"
                  maxLength={20}
                />
                <p className="text-xs text-gray-400 mt-2 text-center">
                  💡 Tip: We auto-detected your name! Change it if you like.
                </p>
              </Card>
            )}

            {/* Quick Play Buttons */}
            <div className="mb-8">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Zap className="w-6 h-6 text-yellow-400" />
                <h2 className="text-2xl font-black">QUICK PLAY</h2>
                <Zap className="w-6 h-6 text-yellow-400" />
              </div>
              <p className="text-center text-gray-300 mb-6">One click to start playing!</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
                {games.map((game) => (
                  <motion.div
                    key={game.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card className={`bg-gradient-to-br ${game.gradient} p-6 border-2 border-white/30 backdrop-blur-xl cursor-pointer hover:shadow-2xl transition-all`}>
                      <div className="text-center mb-4">
                        <div className="text-6xl mb-2">{game.emoji}</div>
                        <h3 className="text-2xl font-black mb-1">{game.name}</h3>
                        <p className="text-sm text-white/80">{game.description}</p>
                        <p className="text-xs text-white/60 mt-1">⏱️ {game.duration}</p>
                      </div>
                      
                      <div className="space-y-2">
                        {/* Quick Play Button */}
                        <Button
                          onClick={() => handleQuickPlay(game.id)}
                          disabled={!connected}
                          className="w-full bg-white text-black hover:bg-gray-100 font-black text-lg py-6 rounded-xl shadow-lg"
                        >
                          <Zap className="w-5 h-5 mr-2" />
                          QUICK PLAY
                        </Button>

                        {/* Invite Friend */}
                        <Button
                          onClick={() => generateInviteLink(game.id)}
                          variant="outline"
                          className="w-full border-white/30 text-white hover:bg-white/10 text-sm py-3"
                        >
                          <Link2 className="w-4 h-4 mr-2" />
                          Invite Friend
                        </Button>
                      </div>

                      {/* Last Played Badge */}
                      {localStorage.getItem('mp_last_game') === game.id && (
                        <div className="mt-3 text-center">
                          <span className="inline-flex items-center gap-1 bg-yellow-500/20 border border-yellow-400/30 px-3 py-1 rounded-full text-xs">
                            <Crown className="w-3 h-3" />
                            Last Played
                          </span>
                        </div>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Classic Mode */}
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-4">Or use classic mode:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto mb-4">
                {games.map((game) => (
                  <Button
                    key={game.id}
                    onClick={() => setSelectedGame(game.id)}
                    variant={selectedGame === game.id ? 'default' : 'outline'}
                    className={`${
                      selectedGame === game.id 
                        ? `bg-gradient-to-r ${game.gradient} border-white/30` 
                        : 'border-white/20 hover:bg-white/10'
                    } text-white`}
                  >
                    {game.emoji} {game.name}
                  </Button>
                ))}
              </div>
              {selectedGame && (
                <Button
                  onClick={handleFindMatch}
                  disabled={!connected || !userName.trim()}
                  className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 font-bold text-xl py-6 px-10 rounded-xl shadow-2xl"
                >
                  <Users className="w-6 h-6 mr-2" />
                  FIND MATCH
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center">
            <Card className="inline-block bg-white/10 backdrop-blur-xl border-2 border-cyan-400 p-8 max-w-md">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                className="text-7xl mb-4"
              >
                🎮
              </motion.div>
              <h2 className="text-3xl font-black mb-4">FINDING OPPONENT...</h2>
              <p className="text-gray-300 mb-2">
                {games.find(g => g.id === selectedGame)?.emoji} {games.find(g => g.id === selectedGame)?.name}
              </p>
              <p className="text-sm text-gray-400 mb-6">
                ⚡ Lightning-fast matching • Usually under 5 seconds
              </p>
              
              {/* Cancel Button */}
              <Button
                onClick={leaveMatchmaking}
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                data-testid="matchmaking-cancel"
              >
                Cancel Search
              </Button>

              {/* AI-Bot Fallback — appears after 8s without a match. Lets the
                  user enter a single-player AI room so they can SEE the actual
                  game UI without waiting for a 2nd human. */}
              <AnimatePresence>
                {showAiFallback && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="mt-4"
                  >
                    <p className="text-xs text-cyan-200 mb-2">
                      No human opponents yet — want to play against AI bots?
                    </p>
                    <Button
                      onClick={playVsAi}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 font-bold text-base py-4 px-8 rounded-xl shadow-lg shadow-cyan-500/30"
                      data-testid="play-vs-ai-fallback"
                    >
                      🤖 Play vs AI Bots
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>
        )}

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 max-w-md mx-auto bg-red-600 text-white px-4 py-3 rounded-lg flex justify-between items-center"
            >
              <span>{error}</span>
              <button onClick={clearError} className="text-white hover:text-gray-200">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Features Info */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 text-center">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="font-bold mb-1">Instant Match</h3>
            <p className="text-xs text-gray-400">Usually under 5 seconds</p>
          </Card>
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 text-center">
            <div className="text-3xl mb-2">🔄</div>
            <h3 className="font-bold mb-1">Real-Time Sync</h3>
            <p className="text-xs text-gray-400">~1 second latency</p>
          </Card>
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 p-4 text-center">
            <div className="text-3xl mb-2">🔗</div>
            <h3 className="font-bold mb-1">Invite Friends</h3>
            <p className="text-xs text-gray-400">Share link to play</p>
          </Card>
        </div>

        {/* Tech Badge */}
        <div className="mt-8 text-center">
          <Card className="inline-block bg-white/5 backdrop-blur-xl border border-white/10 px-6 py-2">
            <p className="text-xs text-gray-400">
              💡 Powered by HTTP Polling • No Socket.IO needed • Works everywhere
            </p>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}
