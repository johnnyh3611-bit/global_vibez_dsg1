import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Users, Trophy, TrendingUp, Eye } from 'lucide-react';
import { PlaceBetModal } from '@/components/watch-and-wager/PlaceBetModal';
import { CoinBalanceWidget } from '@/components/watch-and-wager/CoinBalanceWidget';

const API = process.env.REACT_APP_BACKEND_URL;

export function SpectateGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [pool, setPool] = useState(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showBetModal, setShowBetModal] = useState(false);
  const [userBets, setUserBets] = useState([]);

  useEffect(() => {
    fetchGameData();
    
    // Poll for updates every 3 seconds
    const interval = setInterval(() => {
      fetchGameData();
      fetchPool();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [gameId]);

  const fetchGameData = async () => {
    try {
      // Mock game data for now (backend endpoint needed)
      const gameData = {
        id: gameId,
        type: 'multiplayer',
        game_type: 'blackjack',
        status: 'in_progress',
        players: [
          { id: '1', name: 'Player_Alpha', avatar: '🎮' },
          { id: '2', name: 'Player_Beta', avatar: '🎯' }
        ],
        current_state: {
          round: 3,
          player_scores: { '1': 18, '2': 20 }
        }
      };
      
      setGame(gameData);
      setSpectatorCount(Math.floor(Math.random() * 50) + 10); // Mock spectator count
      setLoading(false);
    } catch (error) {
      // console.error('Error fetching game:', error);
      setLoading(false);
    }
  };

  const fetchPool = async () => {
    try {
      const response = await fetch(`${API}/api/watch-and-wager/pool/${gameId}`, {
      });
      if (!response.ok) throw new Error('Failed to fetch pool');
      const data = await response.json();
      setPool(data.pool);
    } catch (error) {
      // console.error('Error fetching pool:', error);
    }
  };

  const fetchUserBets = async () => {
    try {
      const response = await fetch(`${API}/api/watch-and-wager/my-bets?limit=100`, {
      });
      if (!response.ok) throw new Error('Failed to fetch bets');
      const data = await response.json();
      
      // Filter bets for this specific game
      const gameBets = data.bets.filter(bet => 
        bet.game_id === gameId && bet.status === 'pending'
      );
      setUserBets(gameBets);
    } catch (error) {
      // console.error('Error fetching user bets:', error);
    }
  };

  useEffect(() => {
    if (gameId) {
      fetchUserBets();
    }
  }, [gameId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🎮</div>
          <div className="text-white text-xl">Loading game...</div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <div className="text-white text-xl mb-4">Game not found</div>
          <button
            onClick={() => navigate('/watch-and-wager')}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-xl"
          >
            Back to Games
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 pt-20 pb-8">
      {/* Bet Modal */}
      <PlaceBetModal
        isOpen={showBetModal}
        onClose={() => setShowBetModal(false)}
        gameId={gameId}
        gameType={game.game_type}
        outcomes={game.players.map(p => p.name)}
        onBetPlaced={() => {
          fetchUserBets();
          fetchPool();
        }}
      />

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/watch-and-wager')}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Games
          </button>

          <CoinBalanceWidget compact />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-black text-white mb-2 flex items-center gap-3"
            >
              <span className="text-3xl">🎮</span>
              {game.game_type?.toUpperCase()} - Spectate Mode
              <span className="animate-pulse text-red-500 text-2xl">🔴 LIVE</span>
            </motion.h1>
            <p className="text-white/70 text-lg">
              Watch the action and place your bets!
            </p>
          </div>

          <div className="text-right">
            <div className="flex items-center gap-2 text-white/60 mb-2">
              <Eye className="w-5 h-5" />
              <span className="text-2xl font-bold text-white">{spectatorCount}</span>
              <span>watching</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Viewer */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="backdrop-blur-xl bg-black/40 border-2 border-purple-400/40 rounded-3xl overflow-hidden"
            >
              {/* Game Canvas */}
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-black flex items-center justify-center relative">
                {/* Spectator Mode Indicator */}
                <div className="absolute top-4 left-4 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full border border-yellow-400/50">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-400 font-bold text-sm">SPECTATOR MODE</span>
                  </div>
                </div>

                {/* Game Viewer Component */}
                <div className="text-center text-white/60">
                  <div className="text-6xl mb-4">🎰</div>
                  <div className="text-xl mb-2">Game Viewer</div>
                  <div className="text-sm">Live {game.game_type} gameplay</div>
                  
                  {/* Mock Game State Display */}
                  <div className="mt-6 space-y-2">
                    <div className="text-lg font-bold text-white">Round {game.current_state?.round || 1}</div>
                    {game.players.map((player, i) => (
                      <div key={player.id} className="flex items-center justify-center gap-3 text-white/80">
                        <span className="text-2xl">{player.avatar}</span>
                        <span className="font-bold">{player.name}</span>
                        <span className="text-green-400">
                          Score: {game.current_state?.player_scores?.[player.id] || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Player Info Bar */}
              <div className="bg-black/60 p-4 border-t border-purple-400/20">
                <div className="flex items-center justify-between">
                  <div className="text-white font-bold">Players:</div>
                  <div className="flex gap-4">
                    {game.players.map((player) => (
                      <div key={player.id} className="flex items-center gap-2 px-3 py-1 bg-purple-600/30 rounded-lg">
                        <span>{player.avatar}</span>
                        <span className="text-white text-sm">{player.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Betting Sidebar */}
          <div className="space-y-4">
            {/* Betting Pool Info */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="backdrop-blur-xl bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-2 border-purple-400/40 rounded-2xl p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-black text-white">Betting Pool</h3>
              </div>

              {pool ? (
                <div className="space-y-4">
                  <div className="bg-black/40 rounded-xl p-4">
                    <div className="text-white/60 text-sm mb-1">Total Pool</div>
                    <div className="text-3xl font-black text-yellow-400">
                      {pool.total_pool || 0} coins
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-white/80 font-bold text-sm mb-2">Current Odds:</div>
                    {pool.outcomes?.map((outcome, i) => (
                      <div key={`item-${i}`} className="bg-black/40 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{game.players[i]?.avatar}</span>
                            <span className="text-white font-bold">{outcome.name}</span>
                          </div>
                          <div className="text-green-400 font-black text-xl">
                            {outcome.odds?.toFixed(2) || '1.00'}x
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-white/60">
                          <span>{outcome.total_bets || 0} coins bet</span>
                          <span>{outcome.bet_count || 0} bets</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowBetModal(true)}
                    className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-black text-lg rounded-xl shadow-lg hover:shadow-green-500/50 transition-all"
                  >
                    💰 PLACE BET
                  </motion.button>
                </div>
              ) : (
                <div className="text-center text-white/60 py-8">
                  <div className="text-4xl mb-2">📊</div>
                  <div>Loading betting pool...</div>
                </div>
              )}
            </motion.div>

            {/* User's Active Bets */}
            {userBets.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="backdrop-blur-xl bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border-2 border-cyan-400/40 rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-6 h-6 text-cyan-400" />
                  <h3 className="text-xl font-black text-white">Your Bets</h3>
                </div>

                <div className="space-y-2">
                  {userBets.map((bet, i) => (
                    <div key={bet.id || `userBets-${i}`} className="bg-black/40 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white font-bold">{bet.prediction}</span>
                        <span className="text-yellow-400 font-bold">{bet.amount} coins</span>
                      </div>
                      <div className="text-xs text-white/60">
                        Potential: {Math.round(bet.amount * (bet.odds || 1))} coins
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* How It Works */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4"
            >
              <div className="text-white/60 text-xs space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💡</span>
                  <span className="font-bold text-white">Quick Tips</span>
                </div>
                <p>• Odds update in real-time based on community bets</p>
                <p>• Winners share the pool (minus 5% house edge)</p>
                <p>• Bet closes when game ends</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
