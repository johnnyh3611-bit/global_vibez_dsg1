import { motion, AnimatePresence } from 'framer-motion';
import { Dices, Zap, Shield, Sparkles, X, ChevronDown, History } from 'lucide-react';
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
      className={`h-9 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 flex items-center gap-1 transition-all whitespace-nowrap ${
        anyActive
          ? 'bg-gradient-to-br from-amber-500 to-yellow-600 border-amber-300 text-black shadow-[0_0_10px_rgba(251,191,36,0.6)]'
          : 'bg-black/60 border-white/20 text-gray-300 hover:border-amber-400/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <Shield className="w-3 h-3" />
      Assurance
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
  showRecentRollsPanel,
  setShowRecentRollsPanel,
  rollHistoryCount = 0,
}) => (
  <div
    className="glass-card p-3 rounded-2xl bg-black/55 backdrop-blur-md border border-amber-500/25 space-y-2.5"
    data-testid="betting-controls"
  >
    {/* ROW 1 — Chips · Assurance · Side Bets · Recent Rolls */}
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[9px] uppercase tracking-[0.3em] text-amber-300/80">
        Chip
      </span>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 snap-x">
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
          className={`h-9 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 flex items-center gap-1 transition-all whitespace-nowrap ${
            showSideBetsPanel
              ? 'bg-fuchsia-500/30 border-fuchsia-300 text-fuchsia-100'
              : 'bg-black/60 border-fuchsia-400/40 text-fuchsia-200 hover:border-fuchsia-300'
          }`}
        >
          <Sparkles className="w-3 h-3 text-yellow-300" />
          Side Bets
          {Object.keys(sideBets).length > 0 && (
            <span className="bg-yellow-400 text-black rounded-full px-1.5 text-[9px] font-black">
              {Object.keys(sideBets).length}
            </span>
          )}
          <ChevronDown
            className={`w-3 h-3 transition-transform ${showSideBetsPanel ? 'rotate-180' : ''}`}
          />
        </button>
      )}

      {setShowRecentRollsPanel && (
        <button
          type="button"
          data-testid="vibe654-toggle-recent"
          onClick={() => setShowRecentRollsPanel((v) => !v)}
          className={`h-9 px-2.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 flex items-center gap-1 transition-all whitespace-nowrap ${
            showRecentRollsPanel
              ? 'bg-cyan-500/30 border-cyan-300 text-cyan-100'
              : 'bg-black/60 border-cyan-400/40 text-cyan-200 hover:border-cyan-300'
          }`}
        >
          <History className="w-3 h-3" />
          Recent
          {rollHistoryCount > 0 && (
            <span className="bg-cyan-400 text-black rounded-full px-1.5 text-[9px] font-black">
              {rollHistoryCount}
            </span>
          )}
        </button>
      )}
    </div>

    {/* ROW 2 — Main Bet (compact) · ROLL · Roll Again/Re-Roll inline · Clear */}
    <div className="flex items-center gap-2 flex-wrap">
      <button
        data-testid="main-bet-zone"
        onClick={handleMainBet}
        disabled={gamePhase !== 'IDLE'}
        className="bg-gradient-to-br from-amber-600/30 to-amber-800/30 border-2 border-amber-500/50 rounded-lg px-3 py-1.5 text-left hover:scale-[1.02] transition-transform disabled:opacity-60"
      >
        <p className="text-[9px] uppercase tracking-[0.25em] text-amber-300/80 leading-none">
          Main Bet
        </p>
        <p className="text-lg font-black text-amber-300 leading-tight">
          ₵{mainBet}
        </p>
      </button>

      {/* Primary action — context-aware: ROLL / ROLL AGAIN / RE-ROLL */}
      {gamePhase === 'IDLE' && (
        <Button
          data-testid="roll-dice-btn"
          onClick={handleRollDice}
          disabled={mainBet === 0}
          className={`h-11 px-4 metal-button text-sm font-black ${
            mainBet > 0
              ? 'action-ready-nova action-button'
              : 'opacity-50 cursor-not-allowed'
          }`}
        >
          <Dices className="w-4 h-4 mr-1" /> ROLL
        </Button>
      )}

      {gamePhase === 'ROLLING' && rollsRemaining > 0 && (
        <Button
          data-testid="roll-again-btn"
          onClick={handleRollAgain}
          className="h-11 px-4 metal-button action-ready-nova action-button text-sm font-black bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 border-2 border-green-400"
        >
          <Dices className="w-4 h-4 mr-1 animate-bounce" />
          ROLL AGAIN ({rollsRemaining})
        </Button>
      )}

      {gamePhase === 'DECISION' && rollsRemaining > 0 && (
        <>
          <Button
            data-testid="stand-btn"
            onClick={handleStand}
            className="h-11 px-3 metal-button border-2 border-blue-500/50 text-blue-300 hover:bg-blue-500/10 text-xs font-black flex flex-col items-center justify-center leading-tight"
          >
            <span>STAND</span>
            <span className="text-[10px] text-blue-200">{currentPointScore} PTS</span>
          </Button>
          <Button
            data-testid="reroll-btn"
            onClick={handleReRoll}
            className="h-11 px-3 metal-button action-ready-nova action-button text-xs font-black flex flex-col items-center justify-center leading-tight"
          >
            <span>RE-ROLL</span>
            <span className="text-[10px]">{rollsRemaining} LEFT</span>
          </Button>
        </>
      )}

      {gamePhase === 'COMPLETE' && (
        <Button
          data-testid="new-round-btn"
          onClick={handleNewRound}
          className="h-11 px-4 metal-button action-ready-nova text-sm font-black"
        >
          <Zap className="w-4 h-4 mr-1" /> New Round
        </Button>
      )}

      <Button
        data-testid="clear-bets-btn"
        onClick={handleClearBets}
        size="sm"
        className="h-11 px-3 metal-button border-red-500 text-red-400 hover:bg-red-500/10 text-xs font-bold ml-auto"
        disabled={mainBet === 0 && Object.keys(sideBets).length === 0}
      >
        <X className="w-3.5 h-3.5 mr-1" />
        Clear
      </Button>
    </div>
  </div>
);

export default BettingControls;
