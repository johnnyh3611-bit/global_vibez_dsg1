import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Trophy, Sparkles } from 'lucide-react';
import PremiumDice from './PremiumDice';

export const DiceTable = ({
  currentDiceRoll,
  lockedDice,
  gamePhase,
  isQualified,
  currentPointScore,
  dealerEnvy,
}) => (
  <div
    className="game-table-surface bg-black/60 border-2 border-neutral-800 rounded-3xl p-3 sm:p-5 min-h-[200px] sm:min-h-[280px] flex flex-col items-center justify-center"
    data-testid="dice-table"
  >
    <AnimatePresence mode="wait">
      {currentDiceRoll.length > 0 && (
        <div className="space-y-3 sm:space-y-4 w-full">
          <motion.div
            key={`dice-roll-${currentDiceRoll.join('-')}-${lockedDice.join('-')}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2 sm:gap-3 justify-center flex-wrap"
          >
            {currentDiceRoll.map((value, i) => (
              <PremiumDice
                key={`active-dice-${i}-${value}`}
                value={value}
                rolling={false}
                isQualifier={false}
              />
            ))}
          </motion.div>

          {gamePhase === 'COMPLETE' && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-center mt-4"
            >
              {isQualified ? (
                <div className="glass-card bg-gradient-to-r from-green-900/40 to-emerald-900/40 border-2 border-green-500 p-4">
                  <Trophy className="w-12 h-12 text-amber-400 mx-auto mb-2" />
                  <h3 className="text-3xl font-black text-amber-400">QUALIFIED!</h3>
                  <p className="text-xl mt-1 text-white">
                    Point: <span className="font-black text-amber-400">{currentPointScore}</span>
                  </p>
                  {dealerEnvy > 0 && (
                    <p className="text-sm text-amber-300 mt-1 flex items-center justify-center gap-2">
                      <Sparkles className="w-4 h-4" /> Dealer Envy: ${dealerEnvy}
                    </p>
                  )}
                </div>
              ) : (
                <div className="glass-card bg-gradient-to-r from-red-900/40 to-orange-900/40 border-2 border-red-500 p-4">
                  <h3 className="text-3xl font-black text-red-400">BUST</h3>
                  <p className="text-base mt-1 text-neutral-300">The dice were cold. Reset and reload.</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {currentDiceRoll.length === 0 && (
        <div className="text-center">
          <Dices className="w-24 h-24 text-neutral-800 mx-auto mb-3" />
          <p className="text-neutral-600 italic text-sm">Dice Tray Empty • Place your bets</p>
        </div>
      )}
    </AnimatePresence>
  </div>
);

export default DiceTable;
