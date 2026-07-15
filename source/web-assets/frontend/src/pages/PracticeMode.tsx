import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Brain,
  Trophy,
  Zap,
  Target,
  ArrowLeft,
  Gamepad2,
  Sparkles,
  Flame,
  Star,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import AppFooter from '@/components/AppFooter';
import GameRulesModal from '@/components/GameRulesModal';
import { getListedGames, getClientGameIds, getGameById, GAMES, GameCategory } from '@/data/gamesRegistry';

const API = process.env.REACT_APP_BACKEND_URL;

const CATEGORY_META: Record<
  GameCategory | 'all',
  { name: string; icon: LucideIcon; buttonClass: string; activeButtonClass: string }
> = {
  all: {
    name: 'All Games',
    icon: Gamepad2,
    buttonClass: 'bg-white/5 text-white/70 border-2 border-white/10 hover:bg-white/10 hover:border-white/20',
    activeButtonClass: 'bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white border-2 border-purple-300 shadow-lg shadow-purple-500/50',
  },
  board: {
    name: 'Board',
    icon: Trophy,
    buttonClass: 'bg-white/5 text-white/70 border-2 border-white/10 hover:bg-white/10 hover:border-white/20',
    activeButtonClass: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border-2 border-blue-300 shadow-lg shadow-blue-500/50',
  },
  card: {
    name: 'Card',
    icon: Sparkles,
    buttonClass: 'bg-white/5 text-white/70 border-2 border-white/10 hover:bg-white/10 hover:border-white/20',
    activeButtonClass: 'bg-gradient-to-r from-pink-500 to-rose-600 text-white border-2 border-pink-300 shadow-lg shadow-pink-500/50',
  },
  casino: {
    name: 'Casino',
    icon: Star,
    buttonClass: 'bg-white/5 text-white/70 border-2 border-white/10 hover:bg-white/10 hover:border-white/20',
    activeButtonClass: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border-2 border-yellow-300 shadow-lg shadow-yellow-500/50',
  },
  arcade: {
    name: 'Arcade',
    icon: Zap,
    buttonClass: 'bg-white/5 text-white/70 border-2 border-white/10 hover:bg-white/10 hover:border-white/20',
    activeButtonClass: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-2 border-green-300 shadow-lg shadow-green-500/50',
  },
  social: {
    name: 'Social',
    icon: Flame,
    buttonClass: 'bg-white/5 text-white/70 border-2 border-white/10 hover:bg-white/10 hover:border-white/20',
    activeButtonClass: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-2 border-red-300 shadow-lg shadow-red-500/50',
  },
};

const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', icon: Target, color: 'green', description: 'Perfect for beginners' },
  { id: 'medium', name: 'Medium', icon: Zap, color: 'yellow', description: 'Balanced challenge' },
  { id: 'hard', name: 'Hard', icon: Brain, color: 'red', description: 'Expert opponent' },
];

const DIFFICULTY_ACTIVE_CLASS: Record<string, string> = {
  green:
    'border-green-400 bg-gradient-to-r from-green-500/20 to-emerald-600/20 shadow-lg shadow-green-500/30',
  yellow:
    'border-yellow-400 bg-gradient-to-r from-yellow-500/20 to-amber-600/20 shadow-lg shadow-yellow-500/30',
  red:
    'border-red-400 bg-gradient-to-r from-red-500/20 to-rose-600/20 shadow-lg shadow-red-500/30',
};

const DIFFICULTY_ICON_CLASS: Record<string, string> = {
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  red: 'text-red-400',
};

export default function PracticeMode() {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [starting, setStarting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<GameCategory | 'all'>('all');
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesGame, setRulesGame] = useState<string | null>(null);

  const games = useMemo(() => getListedGames(), []);
  const clientGameIds = useMemo(() => new Set(getClientGameIds()), []);

  const categories = useMemo(() => {
    return (Object.keys(CATEGORY_META) as (GameCategory | 'all')[]).map((id) => ({
      id,
      ...CATEGORY_META[id],
      count: id === 'all' ? games.length : games.filter((g) => g.category === id).length,
    }));
  }, [games]);

  const filteredGames = useMemo(
    () => (selectedCategory === 'all' ? games : games.filter((g) => g.category === selectedCategory)),
    [games, selectedCategory],
  );

  const selectedGameMeta = useMemo(() => getGameById(selectedGame), [selectedGame]);

  const openRulesModal = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRulesGame(gameId);
    setRulesModalOpen(true);
  };

  const startPracticeGame = async () => {
    if (!selectedGame) {
      alert('Please select a game first');
      return;
    }

    // Client-side games run entirely in the browser.
    if (clientGameIds.has(selectedGame)) {
      navigate(`/practice/play/${selectedGame}`);
      return;
    }

    // Server-backed games need a practice session from the backend.
    setStarting(true);
    try {
      const response = await fetch(`${API}/api/practice/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_type: selectedGame,
          difficulty: selectedDifficulty,
        }),
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-4 sm:p-6 pb-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
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
              <Gamepad2 className="w-12 h-12 sm:w-16 sm:h-16 text-purple-400" />
              <div className="absolute -top-1 -right-1">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl sm:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Practice Mode
              </h1>
              <p className="text-purple-200 text-base sm:text-lg">
                {games.length} Games • AI Opponents • Skill Building
              </p>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-purple-500">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <motion.button
                  key={cat.id}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl font-semibold transition-all whitespace-nowrap ${
                    isActive ? cat.activeButtonClass : cat.buttonClass
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{cat.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${
                      isActive ? 'bg-white/20' : 'bg-white/10'
                    }`}
                  >
                    {cat.count}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Game Selection */}
          <div className="lg:col-span-2">
            <Card className="p-4 sm:p-6 bg-black/40 backdrop-blur-xl border-2 border-purple-500/30 shadow-2xl shadow-purple-500/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {selectedCategory === 'all'
                    ? 'All Games'
                    : `${CATEGORY_META[selectedCategory].name} Games`}
                </h2>
                <div className="text-cyan-400 text-sm font-semibold">
                  {filteredGames.length} {filteredGames.length === 1 ? 'Game' : 'Games'}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-500">
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
                      className={`relative p-4 sm:p-5 rounded-2xl border-3 cursor-pointer transition-all group ${
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
                        onClick={(e) => openRulesModal(game.id, e)}
                        className="absolute top-3 right-3 p-1.5 bg-blue-600/80 hover:bg-blue-500 rounded-lg transition-all z-10 group/info"
                        title="View Rules"
                      >
                        <Info className="w-4 h-4 text-white group-hover/info:scale-110 transition-transform" />
                      </button>

                      {/* Emoji with glow */}
                      <div className="relative mb-3">
                        <div
                          className={`absolute inset-0 bg-gradient-to-r ${game.gradient} blur-xl opacity-50 group-hover:opacity-70 transition-opacity`}
                        />
                        <p className="relative text-4xl sm:text-5xl filter drop-shadow-2xl">{game.emoji}</p>
                      </div>

                      {/* Game info */}
                      <h3 className="text-white font-bold text-sm sm:text-base mb-1 line-clamp-1">
                        {game.name}
                      </h3>
                      <p className="text-white/60 text-xs line-clamp-2">{game.description}</p>

                      {/* Gradient bar */}
                      <div
                        className={`mt-3 h-1 rounded-full bg-gradient-to-r ${game.gradient} ${
                          selectedGame === game.id ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'
                        } transition-opacity`}
                      />

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
          <div className="space-y-6">
            {/* Difficulty Selection */}
            <Card className="p-4 sm:p-6 bg-black/40 backdrop-blur-xl border-2 border-purple-500/30 shadow-2xl shadow-purple-500/20">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                AI Difficulty
              </h2>
              <div className="space-y-3">
                {DIFFICULTIES.map((diff) => {
                  const Icon = diff.icon;
                  const isActive = selectedDifficulty === diff.id;
                  return (
                    <motion.button
                      key={diff.id}
                      whileHover={{ scale: 1.02, x: 5 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedDifficulty(diff.id)}
                      className={`w-full p-3 sm:p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        isActive
                          ? DIFFICULTY_ACTIVE_CLASS[diff.color]
                          : 'border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30'
                      }`}
                    >
                      <Icon
                        className={`w-7 h-7 sm:w-8 sm:h-8 ${
                          isActive ? DIFFICULTY_ICON_CLASS[diff.color] : 'text-white/60'
                        }`}
                      />
                      <div className="flex-1 text-left">
                        <p className="text-white font-bold text-base sm:text-lg">{diff.name}</p>
                        <p className="text-white/70 text-xs sm:text-sm">{diff.description}</p>
                      </div>
                      {isActive && <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 animate-pulse" />}
                    </motion.button>
                  );
                })}
              </div>
            </Card>

            {/* Selected Game Info */}
            {selectedGameMeta && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="p-4 sm:p-6 bg-black/40 backdrop-blur-xl border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/30">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    Ready to Play
                  </h3>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative">
                      <div
                        className={`absolute inset-0 bg-gradient-to-r ${selectedGameMeta.gradient} blur-2xl opacity-50`}
                      />
                      <p className="relative text-5xl sm:text-6xl">{selectedGameMeta.emoji}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-bold text-lg sm:text-xl">{selectedGameMeta.name}</p>
                      <p className="text-purple-300 text-sm capitalize flex items-center gap-2">
                        <Brain className="w-4 h-4" />
                        vs {selectedDifficulty} AI
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={startPracticeGame}
                    disabled={starting}
                    className="w-full bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:via-purple-600 hover:to-pink-600 text-white font-bold py-5 sm:py-6 text-base sm:text-lg rounded-xl border-2 border-white/20 shadow-xl hover:shadow-2xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {starting ? (
                      <span className="flex items-center gap-2">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
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
            <Card className="p-4 sm:p-6 bg-black/40 backdrop-blur-xl border-2 border-purple-500/30 shadow-2xl shadow-purple-500/20">
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
