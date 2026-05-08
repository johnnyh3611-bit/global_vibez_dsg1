import { motion } from 'framer-motion';
import { Trophy, Target, Crown, Zap } from 'lucide-react';

export default function GameStatsPanel({ gameState, userPosition }: { gameState?: any, userPosition?: any }) {
  if (!gameState) return null;

  const myTeam = gameState.players_data?.[userPosition]?.team || 'team1';
  const opponentTeam = myTeam === 'team1' ? 'team2' : 'team1';

  const myScore = gameState.scores?.[myTeam] || 0;
  const opponentScore = gameState.scores?.[opponentTeam] || 0;

  const myTricks = gameState.tricks_won?.[myTeam] || 0;
  const opponentTricks = gameState.tricks_won?.[opponentTeam] || 0;

  const trumpSuit = gameState.trump_suit;

  const trumpSymbols = {
    'spades': '♠',
    'hearts': '♥',
    'diamonds': '♦',
    'clubs': '♣',
    'no_trump': '⊗'
  };

  const trumpColors = {
    'spades': 'text-slate-300',
    'hearts': 'text-red-500',
    'diamonds': 'text-blue-500',
    'clubs': 'text-green-500',
    'no_trump': 'text-purple-500'
  };

  return (
    <div className="absolute top-4 left-4 z-30">
      
      {/* Compact Rectangle Score Box - TOP LEFT */}
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-slate-900/85 backdrop-blur-lg rounded-lg border-2 border-amber-500/40 p-2.5 shadow-xl w-44"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <h3 className="text-[11px] font-bold text-amber-300">Scores</h3>
          </div>
          <span className="text-[9px] text-slate-400">Target: {gameState.winning_score || 7}</span>
        </div>

        {/* Team Scores - Horizontal Layout */}
        <div className="flex gap-2 mb-2">
          <div className="flex-1 flex items-center justify-between p-1.5 bg-blue-900/30 rounded border border-blue-500/30">
            <span className="text-[10px] text-blue-300">You</span>
            <span className="text-lg font-black text-blue-300">{myScore}</span>
          </div>

          <div className="flex-1 flex items-center justify-between p-1.5 bg-red-900/30 rounded border border-red-500/30">
            <span className="text-[10px] text-red-300">Opp</span>
            <span className="text-lg font-black text-red-300">{opponentScore}</span>
          </div>
        </div>

        {/* Bottom Row: Books, Trump, Phase */}
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/50">
          
          {/* Books (if playing) */}
          {gameState.phase === 'playing' && (
            <div className="flex items-center gap-2">
              <Target className="w-3 h-3 text-purple-400" />
              <span className="text-[9px] text-slate-300">{myTricks}-{opponentTricks}</span>
            </div>
          )}
          
          {/* Trump */}
          {trumpSuit && (
            <div className="flex items-center gap-1">
              <span className="text-[8px] text-slate-400">Trump:</span>
              <span className={`text-lg ${trumpColors[trumpSuit]}`}>
                {trumpSymbols[trumpSuit]}
              </span>
            </div>
          )}
          
          {/* Phase */}
          <div className="flex items-center gap-1">
            {gameState.phase === 'bidding' && <Zap className="w-3 h-3 text-yellow-400" />}
            {gameState.phase === 'kitty_exchange' && <Crown className="w-3 h-3 text-amber-400" />}
            {gameState.phase === 'playing' && <Target className="w-3 h-3 text-blue-400" />}
            <span className="text-[9px] text-white capitalize truncate max-w-[60px]">
              {gameState.phase?.replace('_', ' ')}
            </span>
          </div>
        </div>
        
        {/* Your Turn Indicator */}
        {gameState.is_your_turn && (
          <div className="mt-1.5 p-1 bg-green-900/40 rounded text-center">
            <span className="text-green-300 text-[9px] font-bold animate-pulse">YOUR TURN</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
