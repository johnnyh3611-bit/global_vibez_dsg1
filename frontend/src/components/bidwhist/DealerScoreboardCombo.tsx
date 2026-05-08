
import { motion } from 'framer-motion';
import { Crown, Trophy } from 'lucide-react';
import MetaHumanDealerVideo from '@/components/MetaHumanDealerVideo';

/**
 * DealerScoreboardCombo - Unified container for Dealer ACE and Team Scoreboard
 * CRITICAL: User requirement - "The Dealer Ace should be right next to the scores board"
 * Position: Top-left of screen (absolute top-4 left-4)
 */
export default function DealerScoreboardCombo({ 
  scores = { team1: 0, team2: 0 },
  booksThisHand = { team1: 0, team2: 0 },
  currentBid = null,
  dealerName = "ACE"
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute top-4 left-4 z-30 flex flex-row gap-4 p-3 bg-slate-950/70 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl"
    >
      {/* LEFT SIDE: Team Scoreboard */}
      <div className="flex flex-col gap-2 min-w-[200px]">
        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-['Cinzel'] text-amber-400 uppercase tracking-wider">Scores</h3>
        </div>

        {/* Team Scores */}
        <div className="flex flex-col gap-2">
          {/* Team 1 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-['Crimson_Text']">Team 1</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-blue-400 font-['Cinzel']">{booksThisHand.team1} books</span>
              <span className="text-lg text-blue-400 font-['Cinzel'] font-bold">{scores.team1}</span>
            </div>
          </div>

          {/* Team 2 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300 font-['Crimson_Text']">Team 2</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-purple-400 font-['Cinzel']">{booksThisHand.team2} books</span>
              <span className="text-lg text-purple-400 font-['Cinzel'] font-bold">{scores.team2}</span>
            </div>
          </div>
        </div>

        {/* Current Bid Info */}
        {currentBid && (
          <div className="mt-2 pt-2 border-t border-white/10">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Current Bid</div>
            <div className="text-sm text-amber-300 font-['Cinzel']">
              {currentBid.amount} books - {currentBid.type}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDE: Dealer ACE */}
      <div className="flex flex-col items-center justify-center gap-2 min-w-[160px] border-l border-white/10 pl-4">
        {/* Dealer Avatar/Video */}
        <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-amber-500/50 shadow-lg">
          <MetaHumanDealerVideo 
            dealerName={dealerName}
            className="w-full h-full object-cover"
          />
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-transparent pointer-events-none" />
        </div>

        {/* Dealer Name */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1">
            <Crown className="w-3 h-3 text-amber-400" />
            <span className="text-xs font-['Cinzel'] text-amber-400 uppercase tracking-widest">Dealer</span>
          </div>
          <span className="text-lg font-['Cinzel'] font-bold text-white">{dealerName}</span>
        </div>

        {/* Active Indicator */}
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[10px] text-green-400 font-['Crimson_Text']">Active</span>
        </div>
      </div>
    </motion.div>
  );
}
