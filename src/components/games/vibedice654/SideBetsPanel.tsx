import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp } from 'lucide-react';
import { SIDE_BET_OPTIONS, MAX_SIDE_BETS } from './constants';

export const SideBetsPanel = ({
  showPanel,
  setShowPanel,
  sideBets,
  sideBetInsurance,
  predictedPoint,
  gamePhase,
  handleSideBet,
}) => (
  <div className="glass-card" data-testid="side-bets-panel">
    <button
      onClick={() => setShowPanel(!showPanel)}
      className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-black text-metal">Side Bets</h3>
        <span className="text-xs font-bold text-amber-400 bg-black/40 px-2 py-1 rounded">
          {Object.keys(sideBets).length}/{MAX_SIDE_BETS}
        </span>
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
          <div className="p-4 pt-0">
            {gamePhase !== 'IDLE' && (
              <div className="mb-3 p-2 bg-red-900/30 border border-red-500/50 rounded">
                <p className="text-xs text-red-300 font-bold text-center">
                  Locked - Dice in play
                </p>
              </div>
            )}

            <p className="text-xs text-amber-400 mb-3 bg-amber-900/20 p-2 rounded border border-amber-500/30">
              ⚠️ Side bets only count on FIRST roll (5 dice)
            </p>
            <div className="space-y-2">
              {SIDE_BET_OPTIONS.map((bet) => {
                const isPlaced = (sideBets[bet.id] || 0) > 0;
                const clickable = gamePhase === 'IDLE';
                return (
                  <div
                    key={`sidebet-${bet.id}`}
                    data-testid={`sidebet-option-${bet.id}`}
                    onClick={() => clickable && handleSideBet(bet.id)}
                    className={`metal-button rounded-lg p-3 transition-all ${
                      clickable
                        ? isPlaced
                          ? 'border-green-500/50 cursor-pointer'
                          : 'hover:border-amber-500 cursor-pointer'
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-bold text-sm flex items-center gap-2">
                        <span>{bet.icon}</span> {bet.name}
                      </p>
                      <span className="text-amber-400 text-xs font-black bg-black/40 px-2 py-1 rounded">
                        {bet.payout}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400">{bet.description}</p>
                    {bet.id === 'POINT_PREDICTION' && predictedPoint && (
                      <p className="text-xs text-purple-400 mt-1 font-bold">
                        Predicted: {predictedPoint}
                      </p>
                    )}
                    {isPlaced && (
                      <div className="mt-2 pt-2 border-t border-green-500/30">
                        <p className="text-xs text-green-400 font-bold">
                          ✓ Bet: ${sideBets[bet.id]}
                        </p>
                        {sideBetInsurance[bet.id] && (
                          <p className="text-xs text-blue-400 font-bold">
                            ✓ Insurance: ${sideBets[bet.id]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

export default SideBetsPanel;
