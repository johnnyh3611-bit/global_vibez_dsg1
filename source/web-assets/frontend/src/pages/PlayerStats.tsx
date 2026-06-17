import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Trophy, Target, TrendingUp, Clock, Zap, Award,
  ArrowLeft, Crown, Star, Gamepad2, Sparkles
} from 'lucide-react';
import { RoomLayout } from '@/components/RoomLayout';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import AppFooter from '@/components/AppFooter';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function PlayerStats() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchAchievements();
    fetchGlobalStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stats/detailed`, {
      });
      const data = await response.json();
      setStats(data.stats || []);
    } catch (error) {
      // console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAchievements = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stats/achievements`, {
      });
      const data = await response.json();
      setAchievements(data.achievements || []);
    } catch (error) {
      // console.error('Failed to fetch achievements:', error);
    }
  };

  const fetchGlobalStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stats/global`);
      const data = await response.json();
      setGlobalStats(data);
    } catch (error) {
      // console.error('Failed to fetch global stats:', error);
    }
  };

  const totalGames = stats.reduce((sum, s) => sum + s.total_games, 0);
  const totalWins = stats.reduce((sum, s) => sum + s.wins, 0);
  const totalLosses = stats.reduce((sum, s) => sum + s.losses, 0);
  const overallWinRate = totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : 0;

  const unlockedAchievements = achievements.filter(a => a.unlocked);

  if (loading) {
    return (
      <RoomLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
          <div className="text-white text-xl">Loading stats...</div>
        </div>
      </RoomLayout>
    );
  }

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
              Player Statistics
            </h1>
            <div className="w-32" /> {/* Spacer */}
          </div>
        </header>

        <div className="container mx-auto px-4">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <GlassCard className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Gamepad2 className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Games</p>
                  <p className="text-3xl font-bold text-white">{totalGames}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Wins</p>
                  <p className="text-3xl font-bold text-green-400">{totalWins}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Target className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Total Losses</p>
                  <p className="text-3xl font-bold text-red-400">{totalLosses}</p>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Win Rate</p>
                  <p className="text-3xl font-bold text-yellow-400">{overallWinRate}%</p>
                </div>
              </div>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Per-Game Stats */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-cyan-400" />
                Game Performance
              </h2>
              
              <div className="space-y-4">
                {stats.map((gameStat) => (
                  <motion.div
                    key={gameStat.game_type}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedGame(selectedGame === gameStat.game_type ? null : gameStat.game_type)}
                    className="cursor-pointer"
                  >
                    <GlassCard hoverable={true} className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold text-white capitalize">
                          {gameStat.game_type.replace(/_/g, ' ')}
                        </h3>
                        <div className="text-sm text-cyan-400 font-bold">
                          {gameStat.win_rate.toFixed(1)}% Win Rate
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold text-white">{gameStat.total_games}</p>
                          <p className="text-xs text-slate-400">Played</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-green-400">{gameStat.wins}</p>
                          <p className="text-xs text-slate-400">Wins</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-red-400">{gameStat.losses}</p>
                          <p className="text-xs text-slate-400">Losses</p>
                        </div>
                      </div>

                      {gameStat.best_score > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Best Score:</span>
                            <span className="text-yellow-400 font-bold">{gameStat.best_score}</span>
                          </div>
                        </div>
                      )}

                      {gameStat.best_streak > 0 && (
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-slate-400">Best Streak:</span>
                          <span className="text-cyan-400 font-bold flex items-center gap-1">
                            <Zap className="w-4 h-4" />
                            {gameStat.best_streak} wins
                          </span>
                        </div>
                      )}
                    </GlassCard>
                  </motion.div>
                ))}

                {stats.length === 0 && (
                  <GlassCard className="p-12 text-center">
                    <Gamepad2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 text-lg">No games played yet!</p>
                    <p className="text-slate-500 text-sm mt-2">Start playing to track your stats</p>
                    <Button
                      onClick={() => navigate('/games-new')}
                      className="mt-6 bg-gradient-to-r from-cyan-600 to-blue-700 text-white"
                    >
                      Play Now
                    </Button>
                  </GlassCard>
                )}
              </div>
            </div>

            {/* Achievements */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Award className="w-6 h-6 text-yellow-400" />
                Achievements
              </h2>

              <div className="space-y-3">
                {achievements.map((achievement) => (
                  <motion.div
                    key={achievement.achievement_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <GlassCard className={`p-4 ${achievement.unlocked ? 'bg-yellow-500/10 border-yellow-500/30' : 'opacity-50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`text-4xl ${achievement.unlocked ? 'grayscale-0' : 'grayscale'}`}>
                          {achievement.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-white flex items-center gap-2">
                            {achievement.name}
                            {achievement.unlocked && <Crown className="w-4 h-4 text-yellow-400" />}
                          </h3>
                          <p className="text-sm text-slate-400">{achievement.description}</p>
                          {achievement.unlocked && achievement.unlocked_at && (
                            <p className="text-xs text-yellow-400 mt-1">
                              Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/30">
                <p className="text-sm text-center text-yellow-400 font-bold">
                  {unlockedAchievements.length} / {achievements.length} Unlocked
                </p>
              </div>
            </div>
          </div>

          {/* Global Stats */}
          {globalStats && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Star className="w-6 h-6 text-purple-400" />
                Global Statistics
              </h2>
              <GlassCard className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-3xl font-bold text-purple-400">{globalStats.total_games_played?.toLocaleString()}</p>
                    <p className="text-sm text-slate-400 mt-1">Total Games Played</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-cyan-400">{globalStats.total_players?.toLocaleString()}</p>
                    <p className="text-sm text-slate-400 mt-1">Total Players</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white capitalize">
                      {globalStats.most_popular_games?.[0]?.game_type?.replace(/_/g, ' ') || 'N/A'}
                    </p>
                    <p className="text-sm text-slate-400 mt-1">Most Popular Game</p>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
        </div>

        <AppFooter />
      </div>
    </RoomLayout>
  );
}
