import { CHIP_VALUES } from './utils';
import LoungeChip from './LoungeChip';
import { LOUNGE } from './loungeTheme';

interface BettingPanelProps {
  currentBet: number;
  chipValue: number;
  setChipValue: (v: number) => void;
  placeBet: () => void;
  clearBet: () => void;
  deal: () => void;
}

export const BettingPanel = ({
  currentBet,
  chipValue,
  setChipValue,
  placeBet,
  clearBet,
  deal,
}: BettingPanelProps) => (
  <div className="flex flex-col items-center gap-4" data-testid="betting-panel">
    <div
      data-testid="tap-to-bet"
      onClick={placeBet}
      className="px-10 py-4 rounded-full cursor-pointer transition-transform active:scale-95 hover:scale-105"
      style={{
        background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)',
        border: `1.5px dashed ${LOUNGE.goldLight}`,
        boxShadow: `inset 0 0 20px rgba(212,175,55,0.1), ${LOUNGE.shadow.soft}`,
      }}
    >
      <div
        className="text-[11px] font-bold uppercase tracking-[0.3em]"
        style={{ color: LOUNGE.goldLight, fontFamily: LOUNGE.fontBody }}
      >
        Place Your Bet
      </div>
      {currentBet > 0 && (
        <div
          className="text-2xl font-black tabular-nums mt-1 text-center"
          style={{ color: LOUNGE.goldLight, fontFamily: LOUNGE.fontDisplay }}
        >
          ${currentBet}
        </div>
      )}
    </div>

    <div className="flex gap-3">
      {CHIP_VALUES.map((val) => (
        <LoungeChip
          key={`lounge-chip-${val}`}
          amount={val}
          selected={chipValue === val}
          onClick={() => setChipValue(val)}
        />
      ))}
    </div>

    <div className="flex gap-3 mt-2">
      <button
        data-testid="clear-bet-btn"
        onClick={clearBet}
        disabled={currentBet === 0}
        className="px-7 py-2 rounded-full uppercase tracking-widest text-xs font-bold transition-all active:scale-95 disabled:opacity-30"
        style={{
          background: LOUNGE.bg.charcoal,
          color: '#d4d4d4',
          border: `1px solid ${LOUNGE.goldDark}`,
          fontFamily: LOUNGE.fontBody,
          boxShadow: LOUNGE.shadow.soft,
        }}
      >
        Clear
      </button>

      <button
        data-testid="deal-btn"
        onClick={deal}
        disabled={currentBet === 0}
        className="px-10 py-2 rounded-full uppercase tracking-[0.25em] text-xs font-black transition-all active:scale-95 disabled:opacity-30 hover:brightness-110"
        style={{
          background: LOUNGE.goldGradient,
          color: '#1a0f08',
          border: 'none',
          fontFamily: LOUNGE.fontBody,
          boxShadow: `${LOUNGE.shadow.glow}, ${LOUNGE.shadow.soft}`,
        }}
      >
        Deal
      </button>
    </div>
  </div>
);

export default BettingPanel;
