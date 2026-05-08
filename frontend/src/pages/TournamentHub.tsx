import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trophy, Users, Calendar, Coins, Play, ChevronRight } from 'lucide-react';

export default function TournamentHub() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // active, upcoming, completed
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
  }, [activeTab]);

  const fetchTournaments = async () => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL;
      // Updated to use new backend endpoint
      const response = await fetch(`${API_URL}/api/tournaments/active`);
      const data = await response.json();
      
      if (data.success) {
        setTournaments(data.tournaments || []);
      } else {
        setTournaments([]);
      }
    } catch (error) {
      // console.error('Failed to fetch tournaments:', error);
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  };

  const TournamentCard = ({ tournament }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="group"
    >
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-cyan-500/30 hover:border-cyan-500/60 p-6 transition-all duration-300">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">{tournament.name}</h3>
            <p className="text-cyan-400 text-sm uppercase tracking-wider">{tournament.game_type}</p>
          </div>
          <div className="bg-yellow-500/20 p-3 rounded-lg border border-yellow-500/50">
            <Trophy className="w-6 h-6 text-yellow-400" />
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-gray-300">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-sm">{tournament.participants_count || 0}/{tournament.max_players} Players</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-sm">₵{(tournament.prize_pool || 0).toLocaleString()} Prize</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar className="w-4 h-4 text-purple-400" />
            <span className="text-sm">{new Date(tournament.start_time).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Play className="w-4 h-4 text-green-400" />
            <span className="text-sm capitalize">{tournament.format}</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
            tournament.status === 'registration' ? 'bg-green-500/20 text-green-400 border border-green-500/50' :
            tournament.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' :
            'bg-gray-500/20 text-gray-400 border border-gray-500/50'
          }`}>
            {tournament.status === 'registration' ? '🔓 Open Registration' :
             tournament.status === 'in_progress' ? '⚔️ In Progress' :
             '🏁 Completed'}
          </span>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => navigate(`/tournament/${tournament.id}`)}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold"
        >
          {tournament.status === 'registration' ? 'Join Tournament' :
           tournament.status === 'in_progress' ? 'View Bracket' :
           'View Results'}
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center mb-4">
            <Trophy className="w-16 h-16 text-yellow-400 mr-4" />
            <h1 className="text-6xl font-black text-transparent bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 bg-clip-text">
              Tournament Hub
            </h1>
          </div>
          <p className="text-xl text-gray-400">Compete, Win, and Claim Glory</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          {['active', 'upcoming', 'completed'].map((tab) => (
            <Button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-bold uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              {tab}
            </Button>
          ))}
        </div>

        {/* Create Tournament Button */}
        <div className="flex justify-center mb-8">
          <Button
            onClick={() => navigate('/tournament/create')}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold px-8 py-4 text-lg"
          >
            <Trophy className="w-6 h-6 mr-2" />
            Create Tournament
          </Button>
        </div>

        {/* Tournaments Grid */}
        {loading ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4 animate-spin">🔄</div>
            <p className="text-xl text-gray-400">Loading tournaments...</p>
          </div>
        ) : tournaments.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <Trophy className="w-24 h-24 text-gray-600 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-gray-400 mb-2">No Tournaments Found</h2>
            <p className="text-gray-500 mb-6">Be the first to create one!</p>
            <Button
              onClick={() => navigate('/tournament/create')}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
            >
              Create Tournament
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
