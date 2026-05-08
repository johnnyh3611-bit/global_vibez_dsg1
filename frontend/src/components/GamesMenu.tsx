
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { MatchmakingModal } from '@/components/multiplayer/MatchmakingModal';

const GAME_CATEGORIES = {
  'Card Games': {
    icon: '🎴',
    color: 'from-pink-600 to-purple-600',
    games: [
      { id: 'uno', name: 'UNO', image: '/uno-card.png', route: '/practice/uno', difficulty: 'Easy', players: '2-4' },
      { id: 'poker', name: 'Poker', image: '/poker-card.png', route: '/practice/poker', difficulty: 'Hard', players: '2+' },
      { id: 'spades', name: 'Spades', image: '/spades-card.png', route: '/spades', difficulty: 'Hard', players: '4' },
      { id: 'blackjack', name: 'Blackjack', image: '/blackjack-card.png', route: '/practice/blackjack', difficulty: 'Medium', players: '2+' },
      { id: 'hearts', name: 'Hearts', image: '/hearts-card.png', route: '/practice/hearts', difficulty: 'Medium', players: '4' },
      { id: 'crazy_eights', name: 'Crazy Eights', image: '/crazyeights-card.png', route: '/practice/crazyeights', difficulty: 'Easy', players: '2+' },
      { id: 'go_fish', name: 'Go Fish', image: '/gofish-card.png', route: '/practice/gofish', difficulty: 'Easy', players: '2+' }
    ]
  },
  'Strategy Games': {
    icon: '🧠',
    color: 'from-cyan-600 to-blue-600',
    games: [
      { id: 'chess', name: 'Chess', image: '/chess-card.png', route: '/practice/chess', difficulty: 'Hard', players: '2' },
      { id: 'checkers', name: 'Checkers', image: '/checkers-card.png', route: '/practice/checkers', difficulty: 'Medium', players: '2' },
      { id: 'reversi', name: 'Reversi', image: '/reversi-card.png', route: '/practice/reversi', difficulty: 'Medium', players: '2' }
    ]
  },
  'Classic Games': {
    icon: '🎯',
    color: 'from-orange-600 to-red-600',
    games: [
      { id: 'tictactoe', name: 'Tic-Tac-Toe', image: '/tictactoe-card.png', route: '/practice/tictactoe', difficulty: 'Easy', players: '2' },
      { id: 'connect4', name: 'Connect 4', image: '/connect4-card.png', route: '/practice/connect4', difficulty: 'Medium', players: '2' }
    ]
  }
};

export function GamesMenu() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('Card Games');
  const [stats, setStats] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredGame, setHoveredGame] = useState(null);
  const [matchmakingOpen, setMatchmakingOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);

  useEffect(() => {
    // Fetch user stats from API
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/stats/detailed`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const statsMap = {};
        data.stats?.forEach(s => {
          statsMap[s.game_type] = s;
        });
        setStats(statsMap);
      }
    } catch (error) {
    }
  };

  const categories = Object.keys(GAME_CATEGORIES);
  const currentCategory = GAME_CATEGORIES[selectedCategory];

  // Filter games by search query
  const filteredGames = currentCategory.games.filter(game =>
    game.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleGameClick = (game) => {
    // Navigate to practice game creation for all games (shows AAA visual upgrades)
    navigate('/practice', { state: { selectedGame: game.id } });
  };

  const handleMultiplayerClick = (e, game) => {
    e.stopPropagation(); // Prevent card click
    setSelectedGame(game);
    setMatchmakingOpen(true);
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return 'text-green-400';
      case 'Medium': return 'text-yellow-400';
      case 'Hard': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#080C16] via-[#0F1628] to-[#080C16] text-white p-4 md:p-8">
      {/* Header */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mb-8"
      >
        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text mb-4">
          🎮 GAMES LOBBY
        </h1>
        <p className="text-lg md:text-xl text-white/60">
          Global Vibez DSG™ | 11 Premium Games
        </p>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-2xl mx-auto mb-8"
      >
        <div className="relative">
          <input
            type="text"
            placeholder="🔍 Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 backdrop-blur-xl border-2 border-purple-500/30 rounded-2xl px-6 py-4 text-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-all"
          />
        </div>
      </motion.div>

      {/* Category Tabs */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {categories.map((category, idx) => {
          const isActive = category === selectedCategory;
          const categoryData = GAME_CATEGORIES[category];
          
          return (
            <motion.button
              key={category}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-3 rounded-xl font-bold text-lg transition-all ${
                isActive
                  ? `bg-gradient-to-r ${categoryData.color} shadow-2xl scale-110`
                  : 'bg-black/40 backdrop-blur-xl border-2 border-white/20 hover:border-white/40'
              }`}
            >
              <span className="mr-2">{categoryData.icon}</span>
              {category}
            </motion.button>
          );
        })}
      </div>

      {/* Games Grid */}
      <motion.div
        key={selectedCategory}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredGames.map((game, idx) => {
              const gameStats = stats[game.id] || {};
              const winRate = gameStats.win_rate || 0;
              const totalGames = gameStats.total_games || 0;

              return (
                <motion.div
                  key={game.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ scale: 1.05, y: -10 }}
                  onHoverStart={() => setHoveredGame(game.id)}
                  onHoverEnd={() => setHoveredGame(null)}
                  onClick={() => handleGameClick(game)}
                  className="relative group cursor-pointer"
                >
                  {/* Neon Glow Border */}
                  <div 
                    className={`absolute inset-0 bg-gradient-to-br ${currentCategory.color} rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity`}
                  />
                  
                  {/* Card */}
                  <div className="relative bg-black/80 backdrop-blur-xl rounded-2xl border-2 border-purple-500 group-hover:border-fuchsia-500 transition-colors overflow-hidden">
                    {/* Card Image */}
                    <motion.div
                      animate={{
                        scale: hoveredGame === game.id ? 1.1 : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className="w-full h-64 p-6 flex items-center justify-center"
                    >
                      <img 
                        src={game.image} 
                        alt={game.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          // Fallback to text if image doesn't exist
                          const imgEl = e.target as HTMLImageElement;
                          imgEl.style.display = 'none';
                          const fallback = imgEl.parentElement?.querySelector('.fallback-emoji') as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      {/* Fallback emoji display */}
                      <div className="fallback-emoji hidden text-8xl items-center justify-center w-full h-full absolute">
                        🎮
                      </div>
                    </motion.div>
                    
                    {/* Game Name Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent p-6">
                      <p className="text-2xl font-black text-white group-hover:text-fuchsia-400 transition-colors text-center mb-3">
                        {game.name}
                      </p>
                      
                      {/* Game Details - Compact */}
                      <div className="flex justify-center gap-4 text-sm mb-4">
                        <span className={`font-bold ${getDifficultyColor(game.difficulty)}`}>
                          {game.difficulty}
                        </span>
                        <span className="text-purple-400">•</span>
                        <span className="font-bold text-cyan-400">{game.players} Players</span>
                      </div>

                      {/* Stats Preview */}
                      {totalGames > 0 && (
                        <div className="flex justify-center gap-4 text-xs text-white/60 mb-4">
                          <span>{winRate}% Win</span>
                          <span>•</span>
                          <span>{totalGames} Games</span>
                        </div>
                      )}

                      {/* Play Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={(e) => { e.stopPropagation(); handleGameClick(game); }}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-bold rounded-lg hover:shadow-lg transition-all"
                        >
                          🎮 Solo
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={(e) => handleMultiplayerClick(e, game)}
                          className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-sm font-bold rounded-lg hover:shadow-lg transition-all"
                        >
                          👥 PvP
                        </motion.button>
                      </div>
                    </div>

                    {/* Corner Badge */}
                    <div className="absolute top-4 right-4 bg-fuchsia-600/90 backdrop-blur-xl px-3 py-1 rounded-full text-xs font-black text-white border border-fuchsia-400 shadow-lg shadow-fuchsia-500/50">
                      NEW
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filteredGames.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-4">😢</div>
            <p className="text-2xl text-white/60">No games found matching "{searchQuery}"</p>
          </motion.div>
        )}
      </motion.div>

      {/* Footer Stats */}
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mt-12 text-white/40 text-sm"
      >
        <p>Global Vibez DSG™ - Next-Gen Gamified Social Dating</p>
        <p className="mt-2">🎯 Practice Mode | 🤖 AI Opponents | 👥 Multiplayer PvP | 📊 Live Stats</p>
      </motion.div>

      {/* Matchmaking Modal */}
      {selectedGame && (
        <MatchmakingModal
          isOpen={matchmakingOpen}
          onClose={() => setMatchmakingOpen(false)}
          gameType={selectedGame.id}
          gameName={selectedGame.name}
        />
      )}
    </div>
  );
}
