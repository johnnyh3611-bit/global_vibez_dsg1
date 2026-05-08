import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Users, Calendar, Zap, Plus, Filter } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function TournamentsListPage() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('user_id');

  const [tournaments, setTournaments] = useState([]);
  const [filter, setFilter] = useState('registration');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTournaments();
  }, [filter]);

  const loadTournaments = async () => {
    try {
      const response = await fetch(`${API}/api/tournaments/list?status=${filter}&limit=50`);
      const data = await response.json();

      if (data.success) {
        setTournaments(data.tournaments);
      }
    } catch (error) {
      // console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTournamentTypeLabel = (type) => {
    const labels = {
      single_elimination: 'Single Elimination',
      double_elimination: 'Double Elimination',
      round_robin: 'Round Robin'
    };
    return labels[type] || type;
  };

  const getGameName = (gameId) => {
    if (!gameId) return '🎮 Game';
    const games = {
      poker: '🃏 Poker',
      spades: '♠️ Spades',
      chess: '♟️ Chess',
      checkers: '⚫ Checkers',
      tictactoe: '⭕ Tic-Tac-Toe',
      // Add more as needed
    };
    return games[gameId] || gameId;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-blue-950 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
            🏆 Tournaments
          </h1>
          <p className="text-gray-400">Compete for glory and prizes</p>
        </div>

        {/* Action Bar */}
        <div className="mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Filters */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {['registration', 'in_progress', 'completed'].map((status) => (
              <motion.button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-6 py-3 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  filter === status
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                    : 'bg-black/40 border border-cyan-500/50 text-gray-300 hover:border-cyan-400'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {status === 'registration' && '📝 Open'}
                {status === 'in_progress' && '⚔️ Live'}
                {status === 'completed' && '✅ Finished'}
              </motion.button>
            ))}
          </div>

          {/* Create Tournament Button */}
          <motion.button
            onClick={() => setShowCreateModal(true)}
            className="px-8 py-4 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-xl font-bold text-white flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{
              boxShadow: [
                '0 0 20px rgba(234, 179, 8, 0.5)',
                '0 0 40px rgba(234, 179, 8, 0.8)',
                '0 0 20px rgba(234, 179, 8, 0.5)'
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Plus className="w-6 h-6" />
            Create Tournament
          </motion.button>
        </div>

        {/* Tournaments Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-white text-xl">Loading tournaments...</div>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-20">
            <Trophy className="w-20 h-20 mx-auto mb-4 text-gray-600" />
            <div className="text-gray-400 text-xl mb-4">No tournaments found</div>
            <p className="text-gray-500">Be the first to create one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournament) => (
              <motion.div
                key={tournament.id || tournament.tournament_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.03 }}
                onClick={() => navigate(`/tournament/${tournament.id || tournament.tournament_id}`)}
                className="bg-black/40 backdrop-blur-xl border border-cyan-500/50 rounded-2xl overflow-hidden cursor-pointer group"
              >
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 p-4 border-b border-cyan-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{getGameName(tournament.game_id || tournament.game_type)?.split(' ')[0] || '🎮'}</span>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                      tournament.status === 'registration' ? 'bg-green-600 text-white' :
                      tournament.status === 'in_progress' ? 'bg-orange-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {tournament.status.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white line-clamp-2">
                    {tournament.name}
                  </h3>
                </div>

                {/* Details */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Users className="w-4 h-4" />
                      <span>{tournament.current_players || tournament.teams?.length || 0}/{tournament.max_players || tournament.max_teams || 8}</span>
                    </div>
                    <div className="text-cyan-400 font-semibold">
                      {getTournamentTypeLabel(tournament.tournament_type) || 'Tournament'}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Zap className="w-4 h-4 text-yellow-400" />
                      <span>Entry: {tournament.entry_fee || 0} XP</span>
                    </div>
                    <div className="text-yellow-400 font-bold">
                      💰 {tournament.prize_pool || tournament.prize || 0} XP
                    </div>
                  </div>

                  {tournament.start_time && (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(tournament.start_time).toLocaleString()}</span>
                    </div>
                  )}

                  {tournament.winner_id && (
                    <div className="mt-2 p-2 bg-yellow-600/20 border border-yellow-500/50 rounded-lg text-center">
                      <div className="text-xs text-yellow-300">🏆 Champion</div>
                      <div className="text-sm font-bold text-white">Winner: {tournament.winner_id}</div>
                    </div>
                  )}
                </div>

                {/* Action */}
                <div className="p-4 border-t border-cyan-500/30">
                  <motion.button
                    className="w-full py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold text-white"
                    whileHover={{ scale: 1.02 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/tournament/${tournament.id || tournament.tournament_id}`);
                    }}
                  >
                    {tournament.status === 'registration' ? 'Join Tournament' :
                     tournament.status === 'in_progress' ? 'Watch Live' :
                     'View Results'}
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* View Leaderboard */}
        <div className="mt-12 text-center">
          <motion.button
            onClick={() => navigate('/tournament-leaderboard')}
            className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl font-bold text-white inline-flex items-center gap-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Trophy className="w-6 h-6" />
            View All-Time Leaderboard
          </motion.button>
        </div>
      </div>

      {/* Create Tournament Modal */}
      {showCreateModal && (
        <CreateTournamentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadTournaments();
          }}
        />
      )}
    </div>
  );
}

// Create Tournament Modal Component
function CreateTournamentModal({ onClose, onCreated }) {
  const userId = localStorage.getItem('user_id');
  const [formData, setFormData] = useState({
    name: '',
    game_id: 'poker',
    max_players: 8,
    entry_fee: 100,
    tournament_type: 'single_elimination'
  });
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCreating(true);

    try {
      const response = await fetch(`${API}/api/tournaments/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          organizer_id: userId
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Tournament created successfully!');
        onCreated();
      } else {
        alert(data.message || 'Failed to create tournament');
      }
    } catch (error) {
      // console.error('Error:', error);
      alert('Error creating tournament');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-br from-purple-900/90 via-black/90 to-cyan-900/90 backdrop-blur-xl rounded-3xl border-2 border-cyan-500/50 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
          Create Tournament
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-cyan-300 mb-2">Tournament Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Friday Night Poker Championship"
              className="w-full px-4 py-3 bg-black/50 border border-cyan-500/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-cyan-300 mb-2">Game</label>
              <select
                value={formData.game_id}
                onChange={(e) => setFormData({ ...formData, game_id: e.target.value })}
                className="w-full px-4 py-3 bg-black/50 border border-cyan-500/50 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="poker">🃏 Poker</option>
                <option value="spades">♠️ Spades</option>
                <option value="chess">♟️ Chess</option>
                <option value="checkers">⚫ Checkers</option>
              </select>
            </div>

            <div>
              <label className="block text-cyan-300 mb-2">Max Players</label>
              <select
                value={formData.max_players}
                onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-black/50 border border-cyan-500/50 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="4">4 Players</option>
                <option value="8">8 Players</option>
                <option value="16">16 Players</option>
                <option value="32">32 Players</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-cyan-300 mb-2">Entry Fee (XP)</label>
              <input
                type="number"
                value={formData.entry_fee}
                onChange={(e) => setFormData({ ...formData, entry_fee: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-black/50 border border-cyan-500/50 rounded-lg text-white focus:outline-none focus:border-cyan-400"
                min="0"
              />
            </div>

            <div>
              <label className="block text-cyan-300 mb-2">Tournament Type</label>
              <select
                value={formData.tournament_type}
                onChange={(e) => setFormData({ ...formData, tournament_type: e.target.value })}
                className="w-full px-4 py-3 bg-black/50 border border-cyan-500/50 rounded-lg text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="single_elimination">Single Elimination</option>
                <option value="double_elimination">Double Elimination</option>
                <option value="round_robin">Round Robin</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-600 rounded-lg font-semibold text-white hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg font-semibold text-white disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Tournament'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
