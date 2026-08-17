import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp } from 'lucide-react';
import { SIDE_BET_OPTIONS } from './constants';

const BetName = ({ betType }) =>
  SIDE_BET_OPTIONS.find((opt) => opt.id === betType)?.name || betType;

export const SideBetResultsPanel = ({
  showSideBetResults,
  sideBetResults,
  sideBets,
  showSideBetResultsPanel,
  setShowSideBetResultsPanel,
}) => {
  const hasResults = showSideBetResults && sideBetResults.length > 0;
  const hasEmptyResults =
    showSideBetResults && sideBetResults.length === 0 && Object.keys(sideBets).length > 0;

  return (
    <AnimatePresence>
      {hasResults && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="glass-card bg-gradient-to-r from-purple-900/40 to-pink-900/40 border-2 border-purple-500"
          data-testid="side-bet-results"
        >
          <button
            onClick={() => setShowSideBetResultsPanel(!showSideBetResultsPanel)}
            className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <h3 className="text-xl font-black text-purple-300">Side Bet Results</h3>
              <span className="text-xs font-bold text-green-400 bg-black/40 px-2 py-1 rounded">
                {sideBetResults.filter((r) => r.won).length}/{sideBetResults.length} Won
              </span>
            </div>
            <motion.div
              animate={{ rotate: showSideBetResultsPanel ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <TrendingUp className="w-5 h-5 text-purple-400" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showSideBetResultsPanel && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="p-6 pt-0 space-y-3">
                  {sideBetResults.map((result, idx) => (
                    <motion.div
                      key={`sbresult-${result.bet_type}-${idx}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.2 }}
                      className={`bg-black/40 rounded-lg p-4 border ${
                        result.won ? 'border-green-400/50' : 'border-red-400/30'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-bold text-lg">
                            <BetName betType={result.bet_type} />
                          </p>
                          <p className="text-sm text-neutral-400">Bet: ₵{Number(result.original_bet || 0).toLocaleString()}</p>
                          {result.insurance_payout > 0 && (
                            <p className="text-sm text-blue-400">
                              + Insurance: ₵{Number(result.insurance_payout || 0).toLocaleString()} (1:1)
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {result.won ? (
                            <>
                              <p className="text-3xl font-black text-green-400">
                                +₵{Number(result.payout || 0).toLocaleString()}
                              </p>
                              {result.insurance_payout > 0 && (
                                <p className="text-lg font-bold text-blue-300">
                                  +₵{Number(result.insurance_payout || 0).toLocaleString()}
                                </p>
                              )}
                              {result.envy_tip > 0 && (
                                <p className="text-xs text-amber-300 mt-1">
                                  Dealer: -₵{Number(result.envy_tip || 0).toLocaleString()}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-2xl font-black text-red-400">LOST</p>
                          )}
                        </div>
                      </div>
                      {result.won && (
                        <div className="mt-2 pt-2 border-t border-purple-500/20 flex justify-between text-sm">
                          <span className="text-neutral-400">Total Win:</span>
                          <span className="text-green-300 font-bold">
                            ₵{Number((result.payout || 0) + (result.insurance_payout || 0)).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ))}
                  <div className="mt-4 pt-4 border-t border-purple-500/30">
                    <div className="flex justify-between items-center">
                      <p className="text-white font-bold">Total Winnings:</p>
                      <p className="text-3xl font-black text-green-400">
                        ₵
                        {sideBetResults
                          .reduce((sum, r) => sum + (r.payout || 0) + (r.insurance_payout || 0), 0)
                          .toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {hasEmptyResults && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="glass-card p-4 bg-gradient-to-r from-red-900/40 to-orange-900/40 border-2 border-red-500"
          data-testid="side-bet-results-empty"
        >
          <p className="text-red-300 font-bold text-center">No Side Bets Hit • Insurance Lost</p>
          <p className="text-sm text-neutral-400 text-center mt-1">
            Side bets only apply to the first 5-dice roll
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SideBetResultsPanel;
