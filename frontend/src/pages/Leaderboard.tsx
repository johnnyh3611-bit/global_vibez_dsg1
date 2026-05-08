import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Medal, ArrowLeft, Crown, Star, TrendingUp } from 'lucide-react';
import { RoomLayout } from '@/components/RoomLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import AppFooter from '@/components/AppFooter';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const GAME_LIST = [
  { id: 'poker', name: 'Poker', emoji: '♠️' },
  { id: 'blackjack', name: 'Blackjack', emoji: '🃏' },
  { id: 'uno', name: 'UNO', emoji: '🎯' },
  { id: 'roulette', name: 'Roulette', emoji: '🎰' },
  { id: 'chess', name: 'Chess', emoji: '♟️' },
  { id: 'go_fish', name: 'Go Fish', emoji: '🐟' },
  { id: 'hearts', name: 'Hearts', emoji: '♥️' },
  { id: 'spades', name: 'Spades', emoji: '♠️' },
];

export default function Leaderboard() {
  const navigate = useNavigate();
  const { gameType } = useParams();
  const [selectedGame, setSelectedGame] = useState(gameType || 'poker');
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard(selectedGame);
  }, [selectedGame]);

  const fetchLeaderboard = async (game) => {
    setLoading(true);
    try {
      // Use new backend endpoint
      const response = await fetch(`${API_URL}/api/leaderboards/global/${game}?limit=100`);
      const data = await response.json();
      
      if (data.success) {
        // Transform backend response to match frontend expectations
        const transformedLeaderboard = (data.leaderboard || []).map((entry, index) => ({
          user_id: entry.user_id,
          name: entry.username || `Player ${entry.user_id}`,
          rank: index + 1,
          wins: entry.total_wins || 0,
          total_games: entry.total_games || 0,
          win_rate: entry.win_rate ? Math.round(entry.win_rate) : 0
        }));
        
        setLeaderboard(transformedLeaderboard);
      } else {
        setLeaderboard([]);
      }
    } catch (error) {
      // console.error('Failed to fetch leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-slate-300" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="text-slate-400 font-bold">#{rank}</span>;
  };

  const getRankBg = (rank) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/50';
    if (rank === 2) return 'bg-gradient-to-r from-slate-400/20 to-slate-500/20 border-slate-400/50';
    if (rank === 3) return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/50';
    return 'bg-slate-800/50';
  };

  return (
    <RoomLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-8">
        {/* Header */}
        <header className="sticky top-0 z-40 backdrop-blur-lg bg-slate-900/80 border-b border-white/10 mb-8">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => navigate('/games-new')}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-5 w-5" />
              Back to Games
            </Button>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              Leaderboards
            </h1>
            <div className="w-32" /> {/* Spacer */}
          </div>
        </header>

        <div className="container mx-auto px-4">
          {/* Game Selection */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-4">Select Game</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {GAME_LIST.map((game) => (
                <motion.button
                  key={game.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedGame(game.id)}
                  className={`px-6 py-3 rounded-lg font-bold whitespace-nowrap transition-all ${
                    selectedGame === game.id
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white shadow-lg'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  <span className="mr-2">{game.emoji}</span>
                  {game.name}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-6 h-6 text-cyan-400" />
              <h2 className="text-2xl font-bold text-white capitalize">
                {selectedGame.replace(/_/g, ' ')} Leaders
              </h2>
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400">
                Loading leaderboard...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No leaderboard data yet</p>
                <p className="text-slate-500 text-sm mt-2">Be the first to play and claim #1!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry) => (
                  <motion.div
                    key={entry.user_id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: entry.rank * 0.05 }}
                    className={`p-4 rounded-lg border-2 ${getRankBg(entry.rank)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 text-center">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-white text-lg">{entry.name}</h3>
                          <p className="text-sm text-slate-400">
                            {entry.total_games} games played
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-400">{entry.wins}</p>
                          <p className="text-xs text-slate-400">Wins</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-cyan-400 flex items-center gap-1">
                            <TrendingUp className="w-5 h-5" />
                            {entry.win_rate}%
                          </p>
                          <p className="text-xs text-slate-400">Win Rate</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </GlassCard>

          {/* CTA */}
          <div className="mt-8 text-center">
            <p className="text-slate-400 mb-4">Want to see your name on the leaderboard?</p>
            <Button
              onClick={() => navigate('/games-new')}
              className="bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-bold px-8 py-3"
            >
              Start Playing
            </Button>
          </div>
        </div>

        <AppFooter />
      </div>
    </RoomLayout>
  );
}
