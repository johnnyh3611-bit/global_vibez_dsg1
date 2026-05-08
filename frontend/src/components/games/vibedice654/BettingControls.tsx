import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Dices, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MetalChip from './MetalChip';

const CHIP_AMOUNTS = [5, 10, 25, 50, 100];

const InsuranceToggle = ({
  sideBets,
  sideBetInsurance,
  setSideBetInsurance,
  gamePhase,
  setDealerMessage,
}) => {
  const hasSideBets = Object.keys(sideBets).length > 0;
  const anyActive = Object.values(sideBetInsurance).some((v) => v);
  const disabled = gamePhase !== 'IDLE' || !hasSideBets;
  const totalCost = (Object.values(sideBets) as number[]).reduce((a, b) => a + b, 0);

  const onToggle = () => {
    const newState = !anyActive;
    const updated = {};
    Object.keys(sideBets).forEach((id) => {
      updated[id] = newState;
    });
    setSideBetInsurance(updated);
    setDealerMessage(
      newState ? 'Insurance ON for all side bets! (1:1 bonus)' : 'Insurance OFF'
    );
  };

  return (
    <div className="mb-4">
      <button
        data-testid="insurance-toggle"
        onClick={onToggle}
        disabled={disabled}
        className={`w-full metal-button p-3 rounded-lg font-bold text-sm transition-all ${
          anyActive
            ? 'bg-blue-500 border-blue-400 text-white'
            : 'bg-neutral-800 border-neutral-600 text-neutral-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
      >
        <div className="flex items-center justify-center gap-2">
          {anyActive ? '✓' : '○'} Insurance (1:1)
        </div>
        <div className="text-xs mt-1 opacity-75">
          {hasSideBets
            ? `${anyActive ? 'ON' : 'OFF'} - Cost: $${totalCost}`
            : 'Place side bets first'}
        </div>
      </button>
    </div>
  );
};

export const BettingControls = ({
  selectedChip,
  setSelectedChip,
  mainBet,
  sideBets,
  sideBetInsurance,
  setSideBetInsurance,
  gamePhase,
  rollsRemaining,
  currentPointScore,
  handleMainBet,
  handleRollDice,
  handleClearBets,
  handleNewRound,
  handleRollAgain,
  handleStand,
  handleReRoll,
  setDealerMessage,
}) => (
  <div className="glass-card p-4 sm:p-5 rounded-2xl bg-black/55 backdrop-blur-md border border-amber-500/25" data-testid="betting-controls">
    <div className="flex items-center justify-between mb-3 sm:mb-4">
      <h3 className="text-sm sm:text-lg font-black text-metal flex items-center gap-2">
        <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" /> Select Chip Value
      </h3>
    </div>

    <InsuranceToggle
      sideBets={sideBets}
      sideBetInsurance={sideBetInsurance}
      setSideBetInsurance={setSideBetInsurance}
      gamePhase={gamePhase}
      setDealerMessage={setDealerMessage}
    />

    <div className="flex gap-2 sm:gap-3 mb-4 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
      {CHIP_AMOUNTS.map((amt) => (
        <div key={`chip-${amt}`} className="snap-start shrink-0">
          <MetalChip
            amount={amt}
            selected={selectedChip === amt}
            onClick={() => setSelectedChip(amt)}
          />
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
      <div>
        <label className="text-[11px] sm:text-sm text-neutral-400 mb-2 block uppercase tracking-wide">
          Main Bet (Required)
        </label>
        <div
          data-testid="main-bet-zone"
          onClick={handleMainBet}
          className="betting-zone metal-button cursor-pointer rounded-xl p-4 sm:p-6 text-center hover:scale-105 transition-transform"
        >
          <p className="text-xl sm:text-3xl font-black text-amber-400">₵{mainBet}</p>
          <p className="text-[10px] sm:text-xs text-neutral-400 mt-1">Tap to add chip</p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:gap-3">
        <Button
          data-testid="roll-dice-btn"
          onClick={handleRollDice}
          disabled={mainBet === 0 || gamePhase !== 'IDLE'}
          className={`metal-button flex-1 text-base sm:text-lg font-black ${
            mainBet > 0 ? 'action-ready-nova action-button' : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <Dices className="w-5 h-5 mr-2" /> ROLL DICE
        </Button>
        <Button
          data-testid="clear-bets-btn"
          onClick={handleClearBets}
          className="metal-button border-red-500 text-red-400 hover:bg-red-500/10 text-sm sm:text-base"
          disabled={mainBet === 0 && Object.keys(sideBets).length === 0}
        >
          Clear Bets
        </Button>
      </div>
    </div>

    {gamePhase === 'COMPLETE' && (
      <Button
        data-testid="new-round-btn"
        onClick={handleNewRound}
        className="w-full metal-button action-ready-nova"
      >
        <Zap className="w-4 h-4 mr-2" /> New Round
      </Button>
    )}

    {gamePhase === 'ROLLING' && rollsRemaining > 0 && (
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full"
      >
        <Button
          data-testid="roll-again-btn"
          onClick={handleRollAgain}
          className="w-full py-6 text-2xl metal-button action-ready-nova action-button font-black bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 border-4 border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.6)]"
        >
          <Dices className="w-6 h-6 mr-2 animate-bounce" />
          ROLL AGAIN ({rollsRemaining} {rollsRemaining === 1 ? 'roll' : 'rolls'} remaining)
        </Button>
      </motion.div>
    )}

    {gamePhase === 'DECISION' && rollsRemaining > 0 && (
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          className="grid grid-cols-2 gap-4"
        >
          <Button
            data-testid="stand-btn"
            onClick={handleStand}
            className="metal-button px-10 py-4 rounded-lg border-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 flex flex-col items-center"
          >
            <span className="text-lg font-black">STAND</span>
            <span className="text-2xl font-black text-blue-300">{currentPointScore} POINTS</span>
          </Button>

          <Button
            data-testid="reroll-btn"
            onClick={handleReRoll}
            className="metal-button action-ready-nova action-button px-10 py-4 rounded-lg flex flex-col items-center"
          >
            <span className="text-lg font-black">RE-ROLL</span>
            <span className="text-sm text-black/70">{rollsRemaining} LEFT</span>
          </Button>
        </motion.div>
      </AnimatePresence>
    )}
  </div>
);

export default BettingControls;
