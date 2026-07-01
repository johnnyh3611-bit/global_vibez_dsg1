import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp } from 'lucide-react';

const statusClass = (status) => (status === 'QUALIFIED' ? 'text-green-400' : 'text-red-400');

export const RecentRollsPanel = ({ showPanel, setShowPanel, rollHistory }) => (
  <div className="glass-card" data-testid="recent-rolls-panel">
    <button
      onClick={() => setShowPanel(!showPanel)}
      className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-400" />
        <h3 className="text-lg font-black text-metal">Recent Rolls</h3>
      </div>
      <motion.div animate={{ rotate: showPanel ? 180 : 0 }} transition={{ duration: 0.3 }}>
        <TrendingUp className="w-5 h-5" />
      </motion.div>
    </button>

    <AnimatePresence>
      {showPanel && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="overflow-hidden"
        >
          <div className="p-4 pt-0 max-h-[350px] overflow-y-auto">
            {rollHistory.length === 0 ? (
              <p className="text-neutral-500 text-sm italic text-center py-4">No rolls yet</p>
            ) : (
              <div className="space-y-2">
                {rollHistory.map((roll, rollIdx) => {
                  const dice = roll.game_result?.rolls?.[0] || roll.dice_roll || [];
                  const status = roll.game_result?.status || 'N/A';
                  const point = roll.game_result?.point || 0;
                  return (
                    <div
                      key={roll.roll_id || `roll-${rollIdx}`}
                      className="metal-button rounded-lg p-2"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold ${statusClass(status)}`}>
                          {status}
                        </span>
                        {point > 0 && (
                          <span className="text-xs text-amber-400">Pt: {point}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {dice.map((val, i) => (
                          <div
                            key={`history-${roll.roll_id || rollIdx}-${i}`}
                            className="w-8 h-8 bg-gradient-to-br from-red-600 to-red-800 rounded text-xs flex items-center justify-center font-bold border border-red-400"
                          >
                            {val}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default RecentRollsPanel;
