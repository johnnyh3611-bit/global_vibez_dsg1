import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Zap, Shield, Sparkles, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MetalChip from './MetalChip';

const CHIP_AMOUNTS = [5, 10, 25, 50, 100];

const AssurancePill = ({
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
      newState ? 'Assurance ON for all side bets! (1:1 bonus)' : 'Assurance OFF'
    );
  };

  return (
    <button
      data-testid="insurance-toggle"
      onClick={onToggle}
      disabled={disabled}
      title={
        hasSideBets
          ? `Assurance ${anyActive ? 'ON' : 'OFF'} · Cost: ₵${totalCost}`
          : 'Place a side bet first to enable Assurance'
      }
      className={`h-10 px-3 rounded-full text-[11px] font-black uppercase tracking-wider border-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
        anyActive
          ? 'bg-gradient-to-br from-amber-500 to-yellow-600 border-amber-300 text-black shadow-[0_0_12px_rgba(251,191,36,0.6)]'
          : 'bg-black/60 border-white/20 text-gray-300 hover:border-amber-400/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Shield className="w-3.5 h-3.5" />
      Assurance
      {anyActive && <span className="text-[9px] opacity-80">1:1</span>}
    </button>
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
  showSideBetsPanel,
  setShowSideBetsPanel,
}) => (
  <div
    className="glass-card p-3 sm:p-4 rounded-2xl bg-black/55 backdrop-blur-md border border-amber-500/25 space-y-3"
    data-testid="betting-controls"
  >
    {/* ROW 1 — Chip strip + Assurance + Side Bets dropdown trigger */}
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] uppercase tracking-[0.3em] text-amber-300/80 mr-0.5">
        Chip
      </span>
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {CHIP_AMOUNTS.map((amt) => (
          <div key={`chip-${amt}`} className="snap-start shrink-0">
            <MetalChip
              amount={amt}
              size="sm"
              selected={selectedChip === amt}
              onClick={() => setSelectedChip(amt)}
            />
          </div>
        ))}
      </div>

      <AssurancePill
        sideBets={sideBets}
        sideBetInsurance={sideBetInsurance}
        setSideBetInsurance={setSideBetInsurance}
        gamePhase={gamePhase}
        setDealerMessage={setDealerMessage}
      />

      {setShowSideBetsPanel && (
        <button
          type="button"
          data-testid="sidebets-dropdown-trigger"
          onClick={() => setShowSideBetsPanel((v) => !v)}
          className={`ml-auto h-10 px-3 rounded-full text-[11px] font-black uppercase tracking-wider border-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
            showSideBetsPanel
              ? 'bg-fuchsia-500/30 border-fuchsia-300 text-fuchsia-100'
              : 'bg-black/60 border-fuchsia-400/40 text-fuchsia-200 hover:border-fuchsia-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
          Side Bets
          {Object.keys(sideBets).length > 0 && (
            <span className="bg-yellow-400 text-black rounded-full px-1.5 py-0 text-[9px] font-black">
              {Object.keys(sideBets).length}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              showSideBetsPanel ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}
    </div>

    {/* ROW 2 — Main Bet pad + ROLL + Clear */}
    <div className="flex items-center gap-2 flex-wrap">
      <button
        data-testid="main-bet-zone"
        onClick={handleMainBet}
        disabled={gamePhase !== 'IDLE'}
        className="flex-1 min-w-[140px] bg-gradient-to-br from-amber-600/30 to-amber-800/30 border-2 border-amber-500/50 rounded-xl px-3 py-2 text-left hover:scale-[1.02] transition-transform disabled:opacity-60"
      >
        <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80">
          Main Bet · Required
        </p>
        <p className="text-xl sm:text-2xl font-black text-amber-300 leading-tight">
          ₵{mainBet}
        </p>
      </button>

      <Button
        data-testid="roll-dice-btn"
        onClick={handleRollDice}
        disabled={mainBet === 0 || gamePhase !== 'IDLE'}
        className={`h-12 px-5 metal-button text-base font-black ${
          mainBet > 0
            ? 'action-ready-nova action-button'
            : 'opacity-50 cursor-not-allowed'
        }`}
      >
        <Dices className="w-4 h-4 mr-1" /> ROLL
      </Button>

      <Button
        data-testid="clear-bets-btn"
        onClick={handleClearBets}
        size="sm"
        className="h-12 px-3 metal-button border-red-500 text-red-400 hover:bg-red-500/10 text-xs font-bold"
        disabled={mainBet === 0 && Object.keys(sideBets).length === 0}
      >
        <X className="w-3.5 h-3.5 mr-1" />
        Clear
      </Button>
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
          className="w-full py-5 text-xl metal-button action-ready-nova action-button font-black bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 border-4 border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.6)]"
        >
          <Dices className="w-5 h-5 mr-2 animate-bounce" />
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
          className="grid grid-cols-2 gap-3"
        >
          <Button
            data-testid="stand-btn"
            onClick={handleStand}
            className="metal-button px-6 py-3 rounded-lg border-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10 flex flex-col items-center"
          >
            <span className="text-base font-black">STAND</span>
            <span className="text-xl font-black text-blue-300">{currentPointScore} POINTS</span>
          </Button>

          <Button
            data-testid="reroll-btn"
            onClick={handleReRoll}
            className="metal-button action-ready-nova action-button px-6 py-3 rounded-lg flex flex-col items-center"
          >
            <span className="text-base font-black">RE-ROLL</span>
            <span className="text-xs text-black/70">{rollsRemaining} LEFT</span>
          </Button>
        </motion.div>
      </AnimatePresence>
    )}
  </div>
);

export default BettingControls;
