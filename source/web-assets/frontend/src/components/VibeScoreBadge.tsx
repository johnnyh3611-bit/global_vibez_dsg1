import { motion } from 'framer-motion';
import { Trophy, Gamepad2, TrendingUp, Star } from 'lucide-react';

export function VibeScoreBadge({ vibeScore, gameElo, size = 'md', showBreakdown = false, breakdown = null }) {
  const sizes = {
    sm: { container: 'text-xs', icon: 12, score: 'text-sm' },
    md: { container: 'text-sm', icon: 16, score: 'text-lg' },
    lg: { container: 'text-base', icon: 20, score: 'text-2xl' }
  };

  const s = sizes[size];

  // Determine tier based on Vibe Score
  const getVibeTier = (score) => {
    if (score >= 5000) return { name: 'Legend', color: 'from-yellow-400 to-orange-500', glow: 'rgba(251,191,36,0.6)' };
    if (score >= 3000) return { name: 'Elite', color: 'from-purple-500 to-pink-500', glow: 'rgba(168,85,247,0.6)' };
    if (score >= 1500) return { name: 'Pro', color: 'from-cyan-500 to-blue-500', glow: 'rgba(6,182,212,0.6)' };
    if (score >= 500) return { name: 'Rising', color: 'from-green-500 to-emerald-500', glow: 'rgba(16,185,129,0.6)' };
    return { name: 'Newcomer', color: 'from-gray-500 to-slate-500', glow: 'rgba(100,116,139,0.6)' };
  };

  // Determine tier based on Game Elo
  const getEloTier = (elo) => {
    if (elo >= 2200) return { name: 'Grandmaster', color: 'from-red-500 to-rose-600', glow: 'rgba(239,68,68,0.6)' };
    if (elo >= 1800) return { name: 'Master', color: 'from-purple-600 to-indigo-600', glow: 'rgba(147,51,234,0.6)' };
    if (elo >= 1500) return { name: 'Expert', color: 'from-blue-500 to-cyan-500', glow: 'rgba(59,130,246,0.6)' };
    if (elo >= 1200) return { name: 'Intermediate', color: 'from-green-500 to-teal-500', glow: 'rgba(34,197,94,0.6)' };
    return { name: 'Beginner', color: 'from-gray-500 to-slate-600', glow: 'rgba(100,116,139,0.6)' };
  };

  const vibeTier = getVibeTier(vibeScore || 0);
  const eloTier = getEloTier(gameElo || 1200);

  return (
    <div className={`flex gap-3 ${s.container}`}>
      {/* Vibe Score */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="flex-1"
      >
        <div
          className={`backdrop-blur-xl bg-gradient-to-br ${vibeTier.color} rounded-xl p-3 border-2 border-white/30`}
          style={{
            boxShadow: `0 0 20px ${vibeTier.glow}`
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Star size={s.icon} className="text-white" />
              <span className="text-white font-bold">Vibe Score</span>
            </div>
            <div className={`font-black text-white ${s.score}`}>
              {vibeScore?.toLocaleString() || 0}
            </div>
          </div>
          <div className="text-white/80 text-xs">{vibeTier.name}</div>
          
          {showBreakdown && breakdown && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <div className="grid grid-cols-2 gap-1 text-xs text-white/70">
                {breakdown.games_played > 0 && (
                  <div>🎮 Games: {breakdown.games_played}</div>
                )}
                {breakdown.matches > 0 && (
                  <div>❤️ Matches: {breakdown.matches}</div>
                )}
                {breakdown.dating_games > 0 && (
                  <div>💕 Dating: {breakdown.dating_games}</div>
                )}
                {breakdown.table_for_two > 0 && (
                  <div>🎲 T4T: {breakdown.table_for_two}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Game Elo */}
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="flex-1"
      >
        <div
          className={`backdrop-blur-xl bg-gradient-to-br ${eloTier.color} rounded-xl p-3 border-2 border-white/30`}
          style={{
            boxShadow: `0 0 20px ${eloTier.glow}`
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Trophy size={s.icon} className="text-white" />
              <span className="text-white font-bold">Game Elo</span>
            </div>
            <div className={`font-black text-white ${s.score}`}>
              {gameElo?.toLocaleString() || 1200}
            </div>
          </div>
          <div className="text-white/80 text-xs">{eloTier.name}</div>
        </div>
      </motion.div>
    </div>
  );
}

export function VibeScoreCompact({ vibeScore, gameElo, showLabels = true }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-fuchsia-600/20 to-pink-600/20 border border-fuchsia-400/30 rounded-lg">
        <Star size={14} className="text-fuchsia-400" />
        {showLabels && <span className="text-white/70">Vibe:</span>}
        <span className="text-white font-bold">{vibeScore?.toLocaleString() || 0}</span>
      </div>
      
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border border-cyan-400/30 rounded-lg">
        <Trophy size={14} className="text-cyan-400" />
        {showLabels && <span className="text-white/70">Elo:</span>}
        <span className="text-white font-bold">{gameElo?.toLocaleString() || 1200}</span>
      </div>
    </div>
  );
}
