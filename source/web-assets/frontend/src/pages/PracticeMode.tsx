
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Brain, Trophy, Zap, Target, ArrowLeft, Gamepad2, Sparkles, Flame, Star, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppFooter from '@/components/AppFooter';
import GameRulesModal from '@/components/GameRulesModal';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PracticeMode() {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [starting, setStarting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesGame, setRulesGame] = useState(null);

  const games = [
    // BOARD GAMES
    { id: 'tictactoe', name: 'Tic-Tac-Toe', emoji: '⭕', description: 'Classic 3x3 strategy', category: 'board', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'connect4', name: 'Connect 4', emoji: '🔴', description: 'Connect 4 in a row', category: 'board', gradient: 'from-red-500 to-yellow-500' },
    { id: 'checkers', name: 'Checkers', emoji: '🟤', description: 'Jump and capture', category: 'board', gradient: 'from-amber-700 to-red-700' },
    { id: 'chess', name: 'Chess', emoji: '♟️', description: 'Strategic masterpiece', category: 'board', gradient: 'from-gray-700 to-gray-900' },
    { id: 'reversi', name: 'Reversi', emoji: '⚫', description: 'Flip opponent pieces', category: 'board', gradient: 'from-green-600 to-gray-800' },
    { id: 'battleship', name: 'Battleship', emoji: '🚢', description: 'Sink enemy fleet', category: 'board', gradient: 'from-blue-600 to-blue-900', badge: 'STRATEGY' },
    { id: 'mancala', name: 'Mancala', emoji: '🪨', description: 'Ancient stone game', category: 'board', gradient: 'from-yellow-700 to-orange-800' },

    // CARD GAMES
    { id: 'poker', name: 'Poker', emoji: '♠️', description: 'Texas Hold\'em', category: 'card', gradient: 'from-green-700 to-emerald-900' },
    { id: 'blackjack', name: 'Blackjack', emoji: '🃏', description: 'Beat the dealer', category: 'card', gradient: 'from-red-700 to-black' },
    { id: 'uno', name: 'UNO', emoji: '🎴', description: 'Match colors & numbers', category: 'card', gradient: 'from-red-500 via-yellow-500 to-blue-500', badge: 'HOT' },
    { id: 'go_fish', name: 'Go Fish', emoji: '🎣', description: 'Collect 4-of-a-kind', category: 'card', gradient: 'from-cyan-500 to-blue-600' },
    { id: 'crazy_eights', name: 'Crazy Eights', emoji: '8️⃣', description: '8s are wild', category: 'card', gradient: 'from-purple-600 to-pink-600' },
    { id: 'hearts', name: 'Hearts', emoji: '♥️', description: 'Avoid hearts', category: 'card', gradient: 'from-pink-600 to-red-700' },
    { id: 'spades', name: 'Spades', emoji: '♠️', description: 'Trump card game', category: 'card', gradient: 'from-gray-800 to-black' },
    { id: 'rummy', name: 'Rummy', emoji: '🎰', description: 'Meld sets and runs', category: 'card', gradient: 'from-orange-600 to-red-700' },
    { id: 'gin_rummy', name: 'Gin Rummy', emoji: '🥃', description: 'Knock & meld', category: 'card', gradient: 'from-amber-600 to-orange-700' },
    { id: 'war', name: 'War', emoji: '⚔️', description: 'High card wins', category: 'card', gradient: 'from-red-600 to-orange-600' },
    { id: 'solitaire', name: 'Solitaire', emoji: '🂡', description: 'Classic patience', category: 'card', gradient: 'from-green-700 to-teal-800' },
    { id: 'dominoes', name: 'Dominoes', emoji: '🀰', description: 'Match tile numbers', category: 'card', gradient: 'from-slate-600 to-slate-800' },
    { id: 'yahtzee', name: 'Yahtzee', emoji: '🎲', description: 'Dice combinations', category: 'card', gradient: 'from-blue-600 to-indigo-700' },

    // CASINO GAMES
    { id: 'roulette', name: 'Roulette', emoji: '🎰', description: 'Spin to win', category: 'casino', gradient: 'from-red-600 via-black to-green-600', badge: 'AI DEALER' },
    { id: 'vibes_slots', name: 'Vibes Slots', emoji: '🎰', description: 'Spin the reels', category: 'casino', gradient: 'from-yellow-500 via-pink-500 to-purple-600', badge: 'NEW' },
    { id: 'vibes_wheel', name: 'Vibes Wheel', emoji: '🎡', description: 'Spin for prizes', category: 'casino', gradient: 'from-pink-500 via-purple-500 to-blue-500', badge: 'NEW' },
    { id: 'vibes_darts', name: 'Vibes Darts', emoji: '🎯', description: '501 Darts', category: 'casino', gradient: 'from-orange-600 to-red-700', badge: 'NEW' },
    { id: 'pool_8ball', name: '8-Ball Pool', emoji: '🎱', description: 'Sink the 8-ball', category: 'casino', gradient: 'from-gray-900 via-blue-700 to-gray-900' },

    // ARCADE GAMES
    { id: 'snake', name: 'Snake', emoji: '🐍', description: 'Eat & grow', category: 'arcade', gradient: 'from-green-500 to-lime-600' },
    { id: 'memory_match', name: 'Memory Match', emoji: '🧠', description: 'Find matching pairs', category: 'arcade', gradient: 'from-purple-500 to-pink-500' },
    { id: 'ping_pong', name: 'Ping Pong', emoji: '🏓', description: 'Classic paddle game', category: 'arcade', gradient: 'from-orange-500 to-red-500' },

    // SOCIAL GAMES
    { id: 'trivia', name: 'Trivia Battle', emoji: '🧠', description: 'Test your knowledge', category: 'social', gradient: 'from-indigo-500 to-purple-600', badge: 'NEW' },
    { id: 'truth_or_dare', name: 'Truth or Dare', emoji: '💘', description: 'Dating icebreaker', category: 'social', gradient: 'from-pink-500 to-red-500', badge: 'HOT' },
    { id: 'two_truths_lie', name: 'Two Truths & A Lie', emoji: '🤔', description: 'Spot the lie', category: 'social', gradient: 'from-cyan-500 to-blue-600', badge: 'NEW' },
  ];

  const categories = [
    { id: 'all', name: 'All Games', icon: Gamepad2, color: 'purple', count: games.length },
    { id: 'board', name: 'Board', icon: Trophy, color: 'blue', count: games.filter(g => g.category === 'board').length },
    { id: 'card', name: 'Card', icon: Sparkles, color: 'pink', count: games.filter(g => g.category === 'card').length },
    { id: 'casino', name: 'Casino', icon: Star, color: 'yellow', count: games.filter(g => g.category === 'casino').length },
    { id: 'arcade', name: 'Arcade', icon: Zap, color: 'green', count: games.filter(g => g.category === 'arcade').length },
    { id: 'social', name: 'Social', icon: Flame, color: 'red', count: games.filter(g => g.category === 'social').length },
  ];

  const difficulties = [
    { id: 'easy', name: 'Easy', icon: Target, color: 'green', description: 'Perfect for beginners' },
    { id: 'medium', name: 'Medium', icon: Zap, color: 'yellow', description: 'Balanced challenge' },
    { id: 'hard', name: 'Hard', icon: Brain, color: 'red', description: 'Expert opponent' }
  ];

  const filteredGames = selectedCategory === 'all' 
    ? games 
    : games.filter(g => g.category === selectedCategory);

  const openRulesModal = (game, e) => {
    e.stopPropagation();
    setRulesGame(game);
    setRulesModalOpen(true);
  };

  const startPracticeGame = async () => {
    if (!selectedGame) {
      alert('Please select a game first');
      return;
    }

    // Client-side games that don't need backend API
    const clientSideGames = ['war', 'gin_rummy', 'solitaire', 'roulette', 'vibes_slots', 'vibes_wheel', 'vibes_darts'];
    
    if (clientSideGames.includes(selectedGame)) {
      // Navigate directly to client-side game without API call
      navigate(`/practice/play/${selectedGame}`);
      return;
    }
    
    // Backend-supported games - call API
    setStarting(true);
    try {
      const response = await fetch(`${API}/api/practice/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        
        body: JSON.stringify({
          game_type: selectedGame,
          difficulty: selectedDifficulty
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start practice game');
      }

      const data = await response.json();
      navigate(`/practice/play/${data.game_id}`);
    } catch (err) {
      // console.error('Error starting practice game:', err);
      alert('Failed to start game. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate('/games')}
            variant="ghost"
            className="text-white hover:bg-white/10 mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Games
          </Button>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <Gamepad2 className="w-16 h-16 text-purple-400" />
              <div className="absolute -top-1 -right-1">
                <Sparkles className="w-6 h-6 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Practice Mode
              </h1>
              <p className="text-purple-200 text-lg">34 Games • AI Opponents • Skill Building</p>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-500">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? `bg-gradient-to-r from-${cat.color}-500 to-${cat.color}-600 text-white border-2 border-${cat.color}-300 shadow-lg shadow-${cat.color}-500/50`
                      : 'bg-white/5 text-white/70 border-2 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{cat.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-white/20' : 'bg-white/10'
                  }`}>
                    {cat.count}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Game Selection - Takes 2 columns */}
          <div className="lg:col-span-2">
            <Card className="p-6 bg-black/40 backdrop-blur-xl border-2 border-purple-500/30 shadow-2xl shadow-purple-500/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">
                  {selectedCategory === 'all' ? 'All Games' : categories.find(c => c.id === selectedCategory)?.name + ' Games'}
                </h2>
                <div className="text-cyan-400 text-sm font-semibold">
                  {filteredGames.length} {filteredGames.length === 1 ? 'Game' : 'Games'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-500">
                <AnimatePresence mode="popLayout">
                  {filteredGames.map((game, index) => (
                    <motion.div
                      key={game.id}
                      initial={{ opacity: 0, scale: 0.8, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                      whileHover={{ scale: 1.05, y: -5 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedGame(game.id)}
                      className={`relative p-5 rounded-2xl border-3 cursor-pointer transition-all group ${
                        selectedGame === game.id
                          ? 'border-cyan-400 bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 shadow-xl shadow-cyan-500/50'
                          : 'border-white/20 bg-gradient-to-br from-white/5 to-white/10 hover:border-purple-400/50 hover:shadow-lg hover:shadow-purple-500/30'
                      }`}
                    >
                      {/* Badge */}
                      {game.badge && (
                        <div className="absolute -top-2 -right-2 z-10">
                          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse">
                            {game.badge}
                          </div>
                        </div>
                      )}

                      {/* Rules Icon */}
                      <button
                        onClick={(e) => openRulesModal(game, e)}
                        className="absolute top-3 right-3 p-1.5 bg-blue-600/80 hover:bg-blue-500 rounded-lg transition-all z-10 group/info"
                        title="View Rules"
                      >
                        <Info className="w-4 h-4 text-white group-hover/info:scale-110 transition-transform" />
                      </button>

                      {/* Emoji with glow */}
                      <div className="relative mb-3">
                        <div className={`absolute inset-0 bg-gradient-to-r ${game.gradient} blur-xl opacity-50 group-hover:opacity-70 transition-opacity`} />
                        <p className="relative text-5xl filter drop-shadow-2xl">{game.emoji}</p>
                      </div>

                      {/* Game info */}
                      <h3 className="text-white font-bold text-base mb-1 line-clamp-1">{game.name}</h3>
                      <p className="text-white/60 text-xs line-clamp-2">{game.description}</p>

                      {/* Gradient bar */}
                      <div className={`mt-3 h-1 rounded-full bg-gradient-to-r ${game.gradient} ${
                        selectedGame === game.id ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'
                      } transition-opacity`} />

                      {/* Selected indicator */}
                      {selectedGame === game.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -bottom-2 left-1/2 -translate-x-1/2"
                        >
                          <div className="bg-cyan-400 text-black text-xs font-bold px-3 py-1 rounded-full">
                            SELECTED
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">{/* Difficulty Selection */}
            <Card className="p-6 bg-black/40 backdrop-blur-xl border-2 border-purple-500/30 shadow-2xl shadow-purple-500/20">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Brain className="w-6 h-6 text-purple-400" />
                AI Difficulty
              </h2>
              <div className="space-y-3">
                {difficulties.map((diff) => {
                  const Icon = diff.icon;
                  const isActive = selectedDifficulty === diff.id;
                  return (
                    <motion.button
                      key={diff.id}
                      whileHover={{ scale: 1.02, x: 5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedDifficulty(diff.id)}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        isActive
                          ? `border-${diff.color}-400 bg-gradient-to-r from-${diff.color}-500/20 to-${diff.color}-600/20 shadow-lg shadow-${diff.color}-500/30`
                          : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30'
                      }`}
                    >
                      <Icon className={`w-8 h-8 ${isActive ? `text-${diff.color}-400` : 'text-white/60'}`} />
                      <div className="flex-1 text-left">
                        <p className="text-white font-bold text-lg">{diff.name}</p>
                        <p className="text-white/70 text-sm">{diff.description}</p>
                      </div>
                      {isActive && (
                        <Trophy className="w-6 h-6 text-yellow-400 animate-pulse" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </Card>

            {/* Selected Game Info */}
            {selectedGame && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-6 bg-black/40 backdrop-blur-xl border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/30">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    Ready to Play
                  </h3>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <div className={`absolute inset-0 bg-gradient-to-r ${games.find(g => g.id === selectedGame)?.gradient} blur-2xl opacity-50`} />
                      <p className="relative text-6xl">
                        {games.find(g => g.id === selectedGame)?.emoji}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-xl">
                        {games.find(g => g.id === selectedGame)?.name}
                      </p>
                      <p className="text-purple-300 text-sm capitalize flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        vs {selectedDifficulty} AI
                      </p>
                    </div>
                  </div>
                  
                  <Button
                    onClick={startPracticeGame}
                    disabled={starting}
                    className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 text-white font-bold py-6 text-lg rounded-xl border-2 border-white/20 shadow-xl hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {starting ? (
                      <span className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <Zap className="w-5 h-5" />
                        </motion.div>
                        Starting...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Gamepad2 className="w-5 h-5" />
                        Start Practice Game
                      </span>
                    )}
                  </Button>
                </Card>
              </motion.div>
            )}

            {/* Quick Stats */}
            <Card className="p-6 bg-black/40 backdrop-blur-xl border-2 border-purple-500/30 shadow-2xl shadow-purple-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Practice Stats</p>
                  <p className="text-white font-bold text-lg">View your progress →</p>
                </div>
                <Button
                  onClick={() => navigate('/practice/stats')}
                  variant="outline"
                  className="border-2 border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 hover:border-cyan-400"
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Stats
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Rules Modal */}
      <GameRulesModal 
        gameType={rulesGame}
        isOpen={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
      />
      
      {/* Footer */}
      <AppFooter />
    </div>
  );
}
