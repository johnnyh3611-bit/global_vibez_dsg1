
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Target, Award, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RoundData {
  bid_winner?: string;
  winning_bid?: number;
  bid_type?: string;
  trump_suit?: string;
  player_tricks?: Record<string, number>;
  tricks_won?: Record<string, number>;
  scores?: Record<string, number>;
  round_winner?: string;
  bid_made?: boolean;
}

interface RoundStatsGameState {
  players_data?: Record<string, { name?: string; team?: string; [k: string]: any }>;
  status?: string;
  [k: string]: any;
}

export interface RoundStatsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  roundData?: RoundData;
  gameState?: RoundStatsGameState;
  onPlayAgain?: () => void;
  onLeave?: () => void;
}

/**
 * Round Stats Modal - Shows comprehensive stats after each hand
 * Displays for 10 seconds, then auto-closes
 * Shows: Books won, bid results, team scores, player performance
 */
export default function RoundStatsModal({ 
  isOpen,
  onClose,
  roundData = {},
  gameState = {},
  onPlayAgain,
  onLeave
}: RoundStatsModalProps) {
  const {
    bid_winner,
    winning_bid,
    bid_type,
    trump_suit,
    player_tricks = {},
    tricks_won = {},
    scores = {},
    round_winner,
    bid_made
  } = roundData;

  const players_data = gameState.players_data || {};

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 rounded-3xl border-2 border-amber-500 shadow-2xl max-w-2xl w-full p-8"
          >
            {/* Header */}
            <div className="text-center mb-6">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="inline-block"
              >
                <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-3" />
              </motion.div>
              <h2 className="text-4xl font-['Cinzel'] font-bold text-amber-300 mb-2">
                Round Complete!
              </h2>
              <p className="text-slate-300 text-lg">
                {bid_made ? '✅ Bid Made!' : '❌ Bid Set'}
              </p>
            </div>

            {/* Bid Info */}
            <div className="bg-slate-950/50 rounded-xl p-4 mb-6 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-amber-400" />
                  <span className="text-sm text-slate-400">Winning Bid:</span>
                </div>
                <span className="font-['Cinzel'] font-bold text-lg text-amber-300">
                  {(() => {
                    const wb = winning_bid as (number | { amount?: number } | null | undefined);
                    if (wb == null) return 0;
                    if (typeof wb === 'number') return wb;
                    return wb.amount || 0;
                  })()} books - {bid_type} {trump_suit ? `(${trump_suit})` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-slate-400">Bid Winner:</span>
                <span className="font-bold text-white uppercase">{bid_winner}</span>
              </div>
            </div>

            {/* Player Stats - Books Won */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {['north', 'south', 'east', 'west'].map((position) => {
                const booksWon = player_tricks[position] || 0;
                const playerData = players_data[position] || {};
                
                return (
                  <div 
                    key={position}
                    className="bg-slate-800/50 rounded-lg p-3 border border-white/10"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400 uppercase">{position}</div>
                        <div className="text-[10px] text-slate-500">{playerData.team}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span className="text-2xl font-['Cinzel'] font-bold text-amber-300">
                          {booksWon}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Team Scores */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl p-4 mb-6 border border-white/10">
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300">Team 1</span>
                  </div>
                  <div className="text-3xl font-['Cinzel'] font-bold text-blue-400">
                    {scores.team1 || 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {tricks_won.team1 || 0} books this round
                  </div>
                </div>
                
                <div className="w-px h-16 bg-white/20"></div>
                
                <div className="text-center">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-300">Team 2</span>
                  </div>
                  <div className="text-3xl font-['Cinzel'] font-bold text-purple-400">
                    {scores.team2 || 0}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {tricks_won.team2 || 0} books this round
                  </div>
                </div>
              </div>
            </div>

            {/* Round Winner */}
            {round_winner && (
              <div className="text-center mb-6">
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="inline-block px-6 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 rounded-full"
                >
                  <span className="font-['Cinzel'] font-bold text-white text-lg">
                    🏆 {round_winner} wins this round!
                  </span>
                </motion.div>
              </div>
            )}

            {/* Auto-close timer */}
            <div className="text-center text-sm text-slate-400 mb-4">
              Auto-closing in 10 seconds...
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={onClose}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-['Cinzel']"
              >
                Continue
              </Button>
              {gameState.status === 'completed' && (
                <>
                  <Button
                    onClick={onPlayAgain}
                    className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-['Cinzel']"
                  >
                    Play Again
                  </Button>
                  <Button
                    onClick={onLeave}
                    className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-['Cinzel']"
                  >
                    Leave Room
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
