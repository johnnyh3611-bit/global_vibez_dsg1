import { motion } from 'framer-motion';
import { Crown, User } from 'lucide-react';

const PlayerPod = ({ position, name, score, isTurn, isDealer, team, booksWon = 0 }: { position?: any; name?: any; score?: any; isTurn?: any; isDealer?: any; team?: any; booksWon?: any }) => {
  // Mapping the layout coordinates
  const posClasses = {
    north: "top-4 left-1/2 -translate-x-1/2",
    south: "bottom-24 left-1/2 -translate-x-1/2 scale-110", // You are slightly larger
    east: "right-8 top-1/2 -translate-y-1/2",
    west: "left-8 top-1/2 -translate-y-1/2",
  };

  // Team colors
  const teamColors = {
    team1: 'from-blue-500/20 to-cyan-500/20',
    team2: 'from-purple-500/20 to-pink-500/20'
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`absolute ${posClasses[position]} transition-all duration-500 z-10`}
    >
      {/* The Glass Shield */}
      <div className={`
        relative p-4 rounded-2xl flex flex-col items-center min-w-[120px]
        backdrop-blur-md bg-white/10 border border-white/20 shadow-2xl
        ${isTurn ? 'ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)]' : ''}
      `}>
        
        {/* Animated Glow for Active Turn */}
        {isTurn && (
          <div className={`absolute -inset-1 bg-gradient-to-r ${teamColors[team] || 'from-amber-500 to-yellow-300'} rounded-2xl blur opacity-20 animate-pulse`} />
        )}

        {/* Dealer Chip */}
        {isDealer && (
          <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white border-2 border-amber-500 shadow-lg flex items-center justify-center">
            <span className="text-amber-900 font-black text-sm">D</span>
          </div>
        )}

        {/* Avatar / Placeholder */}
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${teamColors[team] || 'from-slate-700 to-slate-900'} border border-white/10 mb-2 flex items-center justify-center overflow-hidden`}>
          <User className="w-6 h-6 text-slate-400" />
        </div>

        {/* Player Info with Book Count Cube */}
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm tracking-wide flex items-center gap-1">
            {position === 'south' && <Crown className="w-3 h-3 text-amber-400" />}
            {name || position.toUpperCase()}
          </span>
          
          {/* Book Count Cube - CRITICAL USER REQUIREMENT */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 flex items-center justify-center rounded-sm border border-amber-500 bg-slate-900/80 shadow-[0_0_8px_rgba(251,191,36,0.3)]"
            title={`${booksWon} books won`}
          >
            <span className="text-[10px] text-amber-400 font-['Cinzel'] font-bold">{booksWon}</span>
          </motion.div>
        </div>
        
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Team {team?.replace('team', '')}</span>
        </div>
        
        {score !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-[10px] text-slate-400">Score:</span>
            <span className="text-amber-400 font-black text-base">{score}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PlayerPod;
